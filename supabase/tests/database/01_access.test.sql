-- RLS and business rules. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- ── Fixtures ────────────────────────────────────────────────────────────
-- Users: admin, vendas, stock, leitura (all in org A), outsider (no org).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'admin@test.mz', '{"full_name":"Admin Teste"}'),
  ('00000000-0000-4000-a000-00000000000b', 'vendas@test.mz', '{"full_name":"Vera Vendas"}'),
  ('00000000-0000-4000-a000-00000000000c', 'stock@test.mz', '{"full_name":"Sam Stock"}'),
  ('00000000-0000-4000-a000-00000000000d', 'leitura@test.mz', '{"full_name":"Lia Leitura"}'),
  ('00000000-0000-4000-a000-00000000000e', 'outsider@test.mz', '{"full_name":"Out Sider"}');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  -- Build the claims as postgres: authenticated can't read auth.users.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'email', (select email from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select is((select name from public.profiles where email = 'admin@test.mz'), 'Admin Teste', 'profile created from auth metadata');

-- Admin creates org A.
select pg_temp.act_as('00000000-0000-4000-a000-00000000000a');
create temp table ctx (k text primary key, v uuid) on commit drop;
grant all on ctx to authenticated;
insert into ctx values ('org', public.create_org('Loja Teste'));

select is((select role::text from public.memberships where org_id = (select v from ctx where k = 'org')), 'Admin', 'creator becomes Admin');
select is((select count(*)::int from public.expense_categories where org_id = (select v from ctx where k = 'org')), 6, 'default expense categories created');

-- Add the other members directly as postgres.
select pg_temp.as_postgres();
insert into public.memberships (org_id, user_id, role)
select (select v from ctx where k = 'org'), u.id, u.r::public.app_role
from (values ('00000000-0000-4000-a000-00000000000b'::uuid, 'Vendas'), ('00000000-0000-4000-a000-00000000000c'::uuid, 'Stock'), ('00000000-0000-4000-a000-00000000000d'::uuid, 'Leitura')) u (id, r);

-- ── Catalogue permissions ───────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-00000000000b');
select throws_ok(
  $$ select public.create_product((select v from ctx where k = 'org'), 'Alarme', 'ALM-01', null, 1500, 5, 35) $$,
  '42501', 'Sem permissão para esta ação', 'Vendas cannot create products');

select pg_temp.act_as('00000000-0000-4000-a000-00000000000c');
insert into ctx values ('product', public.create_product((select v from ctx where k = 'org'), 'Alarme', 'ALM-01', null, 1500, 5, 35));
select is((select price from public.price_history where product_id = (select v from ctx where k = 'product')), 1500.00, 'Stock creates products with an initial price');
select throws_ok(
  $$ select public.create_product((select v from ctx where k = 'org'), 'Outro', 'alm-01', null, 1, 0, 0) $$,
  '23505', 'Já existe um produto com este código', 'SKU unique per org, case-insensitive');
insert into ctx values ('service', public.create_product((select v from ctx where k = 'org'), 'Licença', 'SRV-01', null, 500, 0, 0, 'key', true));

-- Lots: Stock creates two received lots (5 @ 50 and 10 @ 60) and one on order.
insert into ctx values ('lotA', public.create_lot((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 5, 'Fornecedor', 'recebido', '[{"label":"Fornecedor","value":250}]'));
select pg_temp.as_postgres();
update public.lots set arrival_date = current_date - 10 where id = (select v from ctx where k = 'lotA');
select pg_temp.act_as('00000000-0000-4000-a000-00000000000c');
insert into ctx values ('lotB', public.create_lot((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 10, '', 'recebido', '[{"label":"Fornecedor","value":600},{"label":"Frete","value":0}]'));
insert into ctx values ('lotC', public.create_lot((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 30, 'X', 'encomendado', '[]'));

select results_eq(
  $$ select code from public.lots where org_id = (select v from ctx where k = 'org') order by code $$,
  $$ values ('ALM-L1'), ('ALM-L2'), ('ALM-L3') $$, 'lot codes are sequential');
select is((select count(*)::int from public.lot_costs where lot_id = (select v from ctx where k = 'lotB')), 1, 'zero-value cost lines are dropped');
select throws_ok(
  $$ select public.update_lot((select v from ctx where k = 'lotA'), (select v from ctx where k = 'product'), 9, '', 'recebido', '[]') $$,
  'P0001', 'Lotes recebidos não podem ser editados', 'received lots are locked');
select is(public.advance_lot((select v from ctx where k = 'lotC'))::text, 'transito', 'lot advances encomendado → trânsito');
select throws_ok(
  $$ select public.create_lot((select v from ctx where k = 'org'), (select v from ctx where k = 'service'), 1, '', 'recebido', '[]') $$,
  '22023', 'Serviços não têm lotes', 'services cannot have lots');

-- ── Sales (FIFO) ────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-00000000000c');
select throws_ok(
  $$ select public.record_sale((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 1, '', current_date) $$,
  '42501', 'Sem permissão para esta ação', 'Stock cannot sell');

select pg_temp.act_as('00000000-0000-4000-a000-00000000000b');
select throws_ok(
  $$ select public.record_sale((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 16, '', current_date) $$,
  'P0001', 'Stock insuficiente: 15 disponíveis', 'cannot oversell');
select throws_ok(
  $$ select public.record_sale((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 1, '', current_date + 1) $$,
  '22023', 'A data não pode ser no futuro', 'no future-dated sales');

insert into ctx values ('sale', public.record_sale((select v from ctx where k = 'org'), (select v from ctx where k = 'product'), 7, ' Oficina ', current_date));
select results_eq(
  $$ select l.code, s.qty, s.price, s.customer, s.sold_by_name from public.sales s join public.lots l on l.id = s.lot_id order by l.code $$,
  $$ values ('ALM-L1', 5, 1500.00::numeric, 'Oficina', 'Vera Vendas'), ('ALM-L2', 2, 1500.00::numeric, 'Oficina', 'Vera Vendas') $$,
  'sale split FIFO across lots at the current price');
select is(
  (select lot_id from public.sales where id = (select v from ctx where k = 'sale')), (select v from ctx where k = 'lotA'),
  'returns the first (oldest-lot) sale row');
select lives_ok(
  $$ select public.record_sale((select v from ctx where k = 'org'), (select v from ctx where k = 'service'), 50, '', current_date) $$,
  'services sell without stock');

-- RLS denials on delete affect zero rows rather than raising.
delete from public.sales where id = (select v from ctx where k = 'sale');
select pg_temp.as_postgres();
select ok(exists (select 1 from public.sales where id = (select v from ctx where k = 'sale')), 'Vendas cannot void sales');

select pg_temp.act_as('00000000-0000-4000-a000-00000000000a');
delete from public.sales where id = (select v from ctx where k = 'sale');
select pg_temp.as_postgres();
select ok(not exists (select 1 from public.sales where id = (select v from ctx where k = 'sale')), 'Admin voids a sale (units return to stock)');

-- ── Expenses ────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-00000000000d');
select throws_ok(
  $$ insert into public.expenses (org_id, amount, date, created_by) values ((select v from ctx where k = 'org'), 100, current_date, auth.uid()) $$,
  '42501', null, 'Leitura cannot record expenses');
select pg_temp.act_as('00000000-0000-4000-a000-00000000000b');
select lives_ok(
  $$ insert into public.expenses (org_id, amount, date, created_by) values ((select v from ctx where k = 'org'), 100, current_date, auth.uid()) $$,
  'Vendas records expenses');
select throws_ok(
  $$ insert into public.expenses (org_id, amount, date, created_by) values ((select v from ctx where k = 'org'), 100, current_date, '00000000-0000-4000-a000-00000000000a') $$,
  '42501', null, 'cannot record an expense as someone else');

-- ── Tenant isolation ────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-00000000000e');
select is((select count(*)::int from public.products), 0, 'outsider sees no products');
select is((select count(*)::int from public.sales), 0, 'outsider sees no sales');
select is((select count(*)::int from public.orgs), 0, 'outsider sees no orgs');
select throws_ok(
  $$ select public.record_sale((select v from ctx where k = 'org'), (select v from ctx where k = 'service'), 1, '', current_date) $$,
  '42501', 'Sem permissão para esta ação', 'outsider cannot sell');

-- ── Team ────────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-00000000000a');
select throws_ok(
  $$ select public.invite_member((select v from ctx where k = 'org'), 'VENDAS@test.mz', 'Stock') $$,
  '23505', 'Esta pessoa já é membro da organização', 'cannot invite an existing member');
insert into ctx values ('invite', public.invite_member((select v from ctx where k = 'org'), ' Outsider@Test.mz ', 'Stock'));
select throws_ok(
  $$ select public.invite_member((select v from ctx where k = 'org'), 'outsider@test.mz', 'Vendas') $$,
  '23505', 'Já existe um convite pendente para este email', 'cannot invite twice');

select throws_ok(
  $$ update public.memberships set role = 'Leitura' where user_id = auth.uid() $$,
  'P0001', 'A organização precisa de pelo menos um administrador', 'last admin cannot be demoted');

select pg_temp.act_as('00000000-0000-4000-a000-00000000000e');
select is((select org_name from public.my_invites()), 'Loja Teste', 'invitee sees the invite with the org name');
select is(public.accept_invite((select v from ctx where k = 'invite')), (select v from ctx where k = 'org'), 'invitee accepts');
select is((select role::text from public.memberships where user_id = auth.uid()), 'Stock', 'invitee joins with the invited role');

-- Join by code
select pg_temp.as_postgres();
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-a000-00000000000f', 'joiner@test.mz', '{"full_name":"Jo Joiner"}');
select pg_temp.act_as('00000000-0000-4000-a000-00000000000f');
select throws_ok($$ select public.request_join('NOPE0000') $$, 'P0002', 'Código de convite inválido', 'bad join code');
select pg_temp.as_postgres();
select set_config('test.join_code', (select lower(join_code) from public.orgs where id = (select v from ctx where k = 'org')), true);
select pg_temp.act_as('00000000-0000-4000-a000-00000000000f');
select is(public.request_join(current_setting('test.join_code')), 'Loja Teste', 'join request by code (case-insensitive)');
select is((select count(*)::int from public.products), 0, 'pending requester still sees no data');

select pg_temp.act_as('00000000-0000-4000-a000-00000000000b');
select throws_ok(
  $$ select public.approve_join_request((select id from public.join_requests limit 1)) $$,
  'P0002', 'Pedido não encontrado', 'non-admins cannot see join requests');
select pg_temp.act_as('00000000-0000-4000-a000-00000000000a');
select lives_ok($$ select public.approve_join_request((select id from public.join_requests limit 1)) $$, 'admin approves');
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-4000-a000-00000000000f'), 'Leitura',
  'approved requester joins read-only');

-- Whole-org deletion cascades despite the last-admin rule.
select pg_temp.act_as('00000000-0000-4000-a000-00000000000a');
delete from public.orgs where id = (select v from ctx where k = 'org');
select pg_temp.as_postgres();
select is((select count(*)::int from public.memberships where org_id = (select v from ctx where k = 'org')), 0, 'deleting an org removes it entirely');

select * from finish();
rollback;
