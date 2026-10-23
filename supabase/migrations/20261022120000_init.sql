-- Mukhero Digital — initial schema
--
-- Multi-tenant: every business row carries org_id. Access is enforced with RLS
-- through private.has_role(). Writes that must be atomic or validated beyond a
-- single row (FIFO sales, lot codes, invites, org creation) go through
-- security-definer functions that check the caller's role explicitly.
--
-- Roles: Admin (everything) · Vendas (sales, expenses, attachments, new expense
-- categories) · Stock (products, prices, lots) · Leitura (read only).
-- Destructive actions are Admin-only.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('Admin', 'Vendas', 'Stock', 'Leitura');
-- "esgotado" (sold out) is derived from stock, never stored.
create type public.lot_status as enum ('encomendado', 'transito', 'recebido');
create type public.currency_code as enum ('MT', 'USD', 'ZAR');

-- ── Profiles ─────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email extensions.citext not null,
  created_at timestamptz not null default now()
);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ── Organisations & membership ──────────────────────────────────────────

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#5B4CF5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  currency public.currency_code not null default 'MT',
  fx numeric(12, 4) not null default 64 check (fx > 0),
  default_margin numeric(7, 2) not null default 35 check (default_margin >= 0),
  min_stock integer not null default 5 check (min_stock >= 0),
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email extensions.citext not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  role public.app_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ── Role helpers (used by RLS) ──────────────────────────────────────────

create function private.has_role(p_org uuid, variadic p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

create function private.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = (select auth.uid()));
$$;

/** Raise unless the caller has one of the roles in the org. */
create function private.require_role(p_org uuid, variadic p_roles public.app_role[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_org, variadic p_roles) then
    raise exception 'Sem permissão para esta ação' using errcode = '42501';
  end if;
end;
$$;

grant execute on function private.has_role(uuid, public.app_role[]) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

-- ── Catalogue ────────────────────────────────────────────────────────────

create table public.product_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index product_types_name_key on public.product_types (org_id, lower(btrim(name)));

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create unique index expense_categories_name_key on public.expense_categories (org_id, lower(btrim(name)));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sku text not null check (char_length(sku) between 1 and 24),
  type_id uuid references public.product_types (id) on delete set null,
  icon text not null default 'category',
  min_stock integer not null default 0 check (min_stock >= 0),
  margin numeric(7, 2) check (margin >= 0),
  is_service boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index products_sku_key on public.products (org_id, lower(sku));

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  price numeric(14, 2) not null check (price >= 0),
  effective_at timestamptz not null default now(),
  set_by uuid references public.profiles (id) on delete set null,
  set_by_name text not null default ''
);
create index price_history_product_idx on public.price_history (product_id, effective_at);

-- ── Lots ─────────────────────────────────────────────────────────────────

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  code text not null,
  qty integer not null check (qty > 0),
  lost integer not null default 0 check (lost >= 0),
  supplier text not null default '—',
  status public.lot_status not null default 'encomendado',
  order_date date not null default current_date,
  arrival_date date,
  created_at timestamptz not null default now(),
  unique (org_id, code),
  check (lost <= qty),
  check ((status = 'recebido') = (arrival_date is not null))
);
create index lots_product_idx on public.lots (product_id);

create table public.lot_costs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  label text not null,
  value numeric(14, 2) not null check (value >= 0),
  position smallint not null default 0
);
create index lot_costs_lot_idx on public.lot_costs (lot_id);

-- ── Sales & expenses ─────────────────────────────────────────────────────

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  lot_id uuid references public.lots (id) on delete restrict,
  qty integer not null check (qty > 0),
  price numeric(14, 2) not null check (price >= 0),
  customer text not null default '' check (char_length(customer) <= 120),
  date date not null,
  sold_by uuid references public.profiles (id) on delete set null,
  sold_by_name text not null default '',
  sold_at timestamptz not null default now()
);
create index sales_org_date_idx on public.sales (org_id, date);
create index sales_lot_idx on public.sales (lot_id);
create index sales_product_idx on public.sales (product_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  category_id uuid references public.expense_categories (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index expenses_org_date_idx on public.expenses (org_id, date);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  sale_id uuid references public.sales (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete cascade,
  name text not null,
  mime text not null default '',
  size integer not null check (size between 0 and 3145728),
  storage_path text not null unique,
  added_by uuid references public.profiles (id) on delete set null,
  added_by_name text not null default '',
  added_at timestamptz not null default now(),
  check (num_nonnulls(sale_id, expense_id) = 1),
  -- Files live under <org_id>/ in the attachments bucket.
  check (split_part(storage_path, '/', 1) = org_id::text)
);
create index attachments_sale_idx on public.attachments (sale_id);
create index attachments_expense_idx on public.attachments (expense_id);

-- ── Integrity triggers ───────────────────────────────────────────────────

/** Child rows must belong to the same org as the rows they reference. */
create function private.check_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean := true;
begin
  -- Test the table name before touching table-specific fields: PL/pgSQL doesn't short-circuit
  -- `and`, so `new.type_id` would be resolved against e.g. a lots row and fail.
  if tg_table_name = 'products' then
    ok := new.type_id is null
      or exists (select 1 from public.product_types t where t.id = new.type_id and t.org_id = new.org_id);
  elsif tg_table_name in ('price_history', 'lots') then
    ok := exists (select 1 from public.products p where p.id = new.product_id and p.org_id = new.org_id);
  elsif tg_table_name = 'lot_costs' then
    ok := exists (select 1 from public.lots l where l.id = new.lot_id and l.org_id = new.org_id);
  elsif tg_table_name = 'sales' then
    ok := exists (select 1 from public.products p where p.id = new.product_id and p.org_id = new.org_id)
      and (new.lot_id is null or exists (select 1 from public.lots l where l.id = new.lot_id and l.org_id = new.org_id));
  elsif tg_table_name = 'expenses' then
    ok := new.category_id is null
      or exists (select 1 from public.expense_categories c where c.id = new.category_id and c.org_id = new.org_id);
  elsif tg_table_name = 'attachments' then
    ok := (new.sale_id is null or exists (select 1 from public.sales s where s.id = new.sale_id and s.org_id = new.org_id))
      and (new.expense_id is null or exists (select 1 from public.expenses e where e.id = new.expense_id and e.org_id = new.org_id));
  end if;
  if not ok then
    raise exception 'Referência a outra organização' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger same_org before insert or update on public.products for each row execute function private.check_same_org();
create trigger same_org before insert or update on public.price_history for each row execute function private.check_same_org();
create trigger same_org before insert or update on public.lots for each row execute function private.check_same_org();
create trigger same_org before insert or update on public.lot_costs for each row execute function private.check_same_org();
create trigger same_org before insert or update on public.sales for each row execute function private.check_same_org();
create trigger same_org before insert or update on public.expenses for each row execute function private.check_same_org();
create trigger same_org before insert or update on public.attachments for each row execute function private.check_same_org();

/** An organisation must always keep at least one Admin. */
create function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deleting the whole org cascades here; allow it.
  if tg_op = 'DELETE' and not exists (select 1 from public.orgs o where o.id = old.org_id) then
    return old;
  end if;
  if old.role = 'Admin' and (tg_op = 'DELETE' or new.role <> 'Admin') then
    if not exists (
      select 1 from public.memberships m
      where m.org_id = old.org_id and m.role = 'Admin' and m.user_id <> old.user_id
    ) then
      raise exception 'A organização precisa de pelo menos um administrador' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger keep_one_admin before update or delete on public.memberships
for each row execute function private.keep_one_admin();

/** Received lots are immutable except for status/lost. */
create function private.guard_received_lot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'recebido' and (new.product_id <> old.product_id or new.qty <> old.qty or new.status <> old.status) then
    raise exception 'Lotes recebidos não podem ser editados' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_received_lot before update on public.lots
for each row execute function private.guard_received_lot();

-- ── Row level security ───────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.join_requests enable row level security;
alter table public.product_types enable row level security;
alter table public.expense_categories enable row level security;
alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.lots enable row level security;
alter table public.lot_costs enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.attachments enable row level security;

-- Profiles: yourself, and anyone who shares an org with you or asked to join yours.
create policy "profiles: read self and teammates" on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.memberships mine join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
  or exists (
    select 1 from public.join_requests r
    where r.user_id = profiles.id and private.has_role(r.org_id, 'Admin')
  )
);
create policy "profiles: update self" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Orgs: members read; Admin updates/deletes. Creation goes through create_org().
create policy "orgs: members read" on public.orgs for select to authenticated using (private.is_member(id));
create policy "orgs: admin update" on public.orgs for update to authenticated
using (private.has_role(id, 'Admin')) with check (private.has_role(id, 'Admin'));
create policy "orgs: admin delete" on public.orgs for delete to authenticated using (private.has_role(id, 'Admin'));

-- Memberships: members read; Admin changes roles / removes (last-admin trigger applies).
-- Anyone may leave an org themselves.
create policy "memberships: members read" on public.memberships for select to authenticated using (private.is_member(org_id));
create policy "memberships: admin update" on public.memberships for update to authenticated
using (private.has_role(org_id, 'Admin')) with check (private.has_role(org_id, 'Admin'));
create policy "memberships: admin remove or self leave" on public.memberships for delete to authenticated
using (private.has_role(org_id, 'Admin') or user_id = (select auth.uid()));

-- Invites: org admins manage; the invitee can see invites addressed to them.
create policy "invites: admin or invitee read" on public.invites for select to authenticated
using (private.has_role(org_id, 'Admin') or email = (select (auth.jwt() ->> 'email'))::extensions.citext);
create policy "invites: admin delete" on public.invites for delete to authenticated using (private.has_role(org_id, 'Admin'));

-- Join requests: admins of the org and the requester.
create policy "join_requests: admin or requester read" on public.join_requests for select to authenticated
using (private.has_role(org_id, 'Admin') or user_id = (select auth.uid()));
create policy "join_requests: admin or requester delete" on public.join_requests for delete to authenticated
using (private.has_role(org_id, 'Admin') or user_id = (select auth.uid()));

-- Catalogue
create policy "product_types: members read" on public.product_types for select to authenticated using (private.is_member(org_id));
create policy "product_types: admin/stock insert" on public.product_types for insert to authenticated
with check (private.has_role(org_id, 'Admin', 'Stock'));
create policy "product_types: admin/stock update" on public.product_types for update to authenticated
using (private.has_role(org_id, 'Admin', 'Stock')) with check (private.has_role(org_id, 'Admin', 'Stock'));
create policy "product_types: admin delete" on public.product_types for delete to authenticated using (private.has_role(org_id, 'Admin'));

create policy "expense_categories: members read" on public.expense_categories for select to authenticated using (private.is_member(org_id));
create policy "expense_categories: admin/vendas insert" on public.expense_categories for insert to authenticated
with check (private.has_role(org_id, 'Admin', 'Vendas'));
create policy "expense_categories: admin update" on public.expense_categories for update to authenticated
using (private.has_role(org_id, 'Admin')) with check (private.has_role(org_id, 'Admin'));
create policy "expense_categories: admin delete" on public.expense_categories for delete to authenticated using (private.has_role(org_id, 'Admin'));

create policy "products: members read" on public.products for select to authenticated using (private.is_member(org_id));
create policy "products: admin/stock update" on public.products for update to authenticated
using (private.has_role(org_id, 'Admin', 'Stock')) with check (private.has_role(org_id, 'Admin', 'Stock'));
-- FK "on delete restrict" from lots/sales blocks deleting products with movements.
create policy "products: admin/stock delete" on public.products for delete to authenticated using (private.has_role(org_id, 'Admin', 'Stock'));

create policy "price_history: members read" on public.price_history for select to authenticated using (private.is_member(org_id));

create policy "lots: members read" on public.lots for select to authenticated using (private.is_member(org_id));
create policy "lot_costs: members read" on public.lot_costs for select to authenticated using (private.is_member(org_id));

create policy "sales: members read" on public.sales for select to authenticated using (private.is_member(org_id));
create policy "sales: admin delete" on public.sales for delete to authenticated using (private.has_role(org_id, 'Admin'));

create policy "expenses: members read" on public.expenses for select to authenticated using (private.is_member(org_id));
create policy "expenses: admin/vendas insert" on public.expenses for insert to authenticated
with check (private.has_role(org_id, 'Admin', 'Vendas') and created_by = (select auth.uid()));
create policy "expenses: admin delete" on public.expenses for delete to authenticated using (private.has_role(org_id, 'Admin'));

create policy "attachments: members read" on public.attachments for select to authenticated using (private.is_member(org_id));
create policy "attachments: admin/vendas insert" on public.attachments for insert to authenticated
with check (private.has_role(org_id, 'Admin', 'Vendas') and added_by = (select auth.uid()));
create policy "attachments: admin delete" on public.attachments for delete to authenticated using (private.has_role(org_id, 'Admin'));

-- ── Functions (RPC) ──────────────────────────────────────────────────────

/** Display name of the caller, for "sold by" style snapshots. */
create function private.my_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.name from public.profiles p where p.id = (select auth.uid())), '');
$$;

create function public.create_org(p_name text, p_color text default '#5B4CF5')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  insert into public.orgs (name, color, created_by) values (btrim(p_name), p_color, v_uid) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'Admin');
  insert into public.product_types (org_id, name) values (v_org, 'Geral');
  insert into public.expense_categories (org_id, name, color)
  select v_org, c.name, c.color
  from (values ('Renda', '#5B4CF5', 1), ('Transporte', '#F2994A', 2), ('Taxas bancárias', '#12B76A', 3),
               ('Salários', '#9E77ED', 4), ('Marketing', '#F04438', 5), ('Outros', '#EAAA08', 6)) as c (name, color, ord)
  order by c.ord;
  return v_org;
end;
$$;

/** Ask to join an org by its join code. Returns the org name. */
create function public.request_join(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.orgs%rowtype;
begin
  select * into v_org from public.orgs where join_code = upper(btrim(p_code));
  if not found then
    raise exception 'Código de convite inválido' using errcode = 'P0002';
  end if;
  if private.is_member(v_org.id) then
    raise exception 'Já é membro de %', v_org.name using errcode = 'P0001';
  end if;
  insert into public.join_requests (org_id, user_id) values (v_org.id, (select auth.uid()))
  on conflict (org_id, user_id) do nothing;
  return v_org.name;
end;
$$;

/** Orgs the caller has asked to join (names are otherwise hidden from non-members). */
create function public.my_join_requests()
returns table (id uuid, org_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, o.name, r.created_at
  from public.join_requests r join public.orgs o on o.id = r.org_id
  where r.user_id = (select auth.uid())
  order by r.created_at;
$$;

/** Invites addressed to the caller's email, with org and inviter names. */
create function public.my_invites()
returns table (id uuid, org_name text, invited_by_name text, role public.app_role)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, o.name, coalesce(p.name, ''), i.role
  from public.invites i
  join public.orgs o on o.id = i.org_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = (select (auth.jwt() ->> 'email'))::extensions.citext
  order by i.created_at;
$$;

create function public.accept_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invites%rowtype;
begin
  select * into v_inv from public.invites
  where id = p_invite and email = (select (auth.jwt() ->> 'email'))::extensions.citext
  for update;
  if not found then
    raise exception 'Convite não encontrado' using errcode = 'P0002';
  end if;
  insert into public.memberships (org_id, user_id, role) values (v_inv.org_id, (select auth.uid()), v_inv.role)
  on conflict (org_id, user_id) do nothing;
  delete from public.invites where id = p_invite;
  delete from public.join_requests where org_id = v_inv.org_id and user_id = (select auth.uid());
  return v_inv.org_id;
end;
$$;

create function public.decline_invite(p_invite uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.invites
  where id = p_invite and email = (select (auth.jwt() ->> 'email'))::extensions.citext;
$$;

create function public.invite_member(p_org uuid, p_email text, p_role public.app_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email));
  v_id uuid;
begin
  perform private.require_role(p_org, 'Admin');
  if exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.org_id = p_org and p.email = v_email
  ) then
    raise exception 'Esta pessoa já é membro da organização' using errcode = '23505';
  end if;
  if exists (select 1 from public.invites i where i.org_id = p_org and i.email = v_email) then
    raise exception 'Já existe um convite pendente para este email' using errcode = '23505';
  end if;
  insert into public.invites (org_id, email, role, invited_by) values (p_org, v_email, p_role, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.approve_join_request(p_request uuid, p_role public.app_role default 'Leitura')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.join_requests%rowtype;
begin
  select * into v_req from public.join_requests where id = p_request for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  perform private.require_role(v_req.org_id, 'Admin');
  insert into public.memberships (org_id, user_id, role) values (v_req.org_id, v_req.user_id, p_role)
  on conflict (org_id, user_id) do nothing;
  delete from public.join_requests where id = p_request;
end;
$$;

/** Create a product with its initial price. */
create function public.create_product(
  p_org uuid, p_name text, p_sku text, p_type uuid, p_price numeric,
  p_min_stock integer, p_margin numeric, p_icon text default 'category', p_is_service boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_sku text := nullif(btrim(p_sku), '');
begin
  perform private.require_role(p_org, 'Admin', 'Stock');
  if v_sku is null then
    v_sku := upper(left(btrim(p_name), 3)) || '-01';
  end if;
  begin
    insert into public.products (org_id, name, sku, type_id, icon, min_stock, margin, is_service)
    values (p_org, btrim(p_name), v_sku, p_type, coalesce(p_icon, 'category'), p_min_stock, p_margin, p_is_service)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um produto com este código' using errcode = '23505';
  end;
  insert into public.price_history (org_id, product_id, price, set_by, set_by_name)
  values (p_org, v_id, coalesce(p_price, 0), (select auth.uid()), private.my_name());
  return v_id;
end;
$$;

create function public.set_price(p_product uuid, p_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_current numeric;
begin
  select org_id into v_org from public.products where id = p_product;
  if v_org is null then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;
  perform private.require_role(v_org, 'Admin', 'Stock');
  if p_price is null or p_price <= 0 then
    raise exception 'Tem de ser maior que zero' using errcode = '22023';
  end if;
  select price into v_current from public.price_history where product_id = p_product order by effective_at desc, id desc limit 1;
  if v_current = p_price then
    raise exception 'O preço é igual ao atual' using errcode = '22023';
  end if;
  insert into public.price_history (org_id, product_id, price, set_by, set_by_name)
  values (v_org, p_product, p_price, (select auth.uid()), private.my_name());
end;
$$;

/** Next free lot code for a product (e.g. ALM-L10). Caller must hold a lock or accept races (unique index guards). */
create function private.next_lot_code(p_org uuid, p_product uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with pfx as (
    select coalesce(nullif(split_part(sku, '-', 1), ''), 'LOT') || '-L' as prefix from public.products where id = p_product
  )
  select pfx.prefix || (greatest(
    (select count(*) from public.lots where product_id = p_product),
    coalesce((
      select max(substr(l.code, char_length(pfx.prefix) + 1)::integer)
      from public.lots l
      where l.org_id = p_org and l.code like pfx.prefix || '%' and substr(l.code, char_length(pfx.prefix) + 1) ~ '^\d+$'
    ), 0)
  ) + 1)::text
  from pfx;
$$;

/** Replace a lot's cost lines from a JSON array of {label, value}. */
create function private.set_lot_costs(p_org uuid, p_lot uuid, p_costs jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.lot_costs where lot_id = p_lot;
  insert into public.lot_costs (org_id, lot_id, label, value, position)
  select p_org, p_lot, c.label, round(c.value, 2), (c.ord - 1)::smallint
  from rows from (jsonb_to_recordset(coalesce(p_costs, '[]'::jsonb)) as (label text, value numeric)) with ordinality as c (label, value, ord)
  where c.value > 0;
end;
$$;

create function public.create_lot(
  p_org uuid, p_product uuid, p_qty integer, p_supplier text, p_status public.lot_status, p_costs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_role(p_org, 'Admin', 'Stock');
  if exists (select 1 from public.products where id = p_product and is_service) then
    raise exception 'Serviços não têm lotes' using errcode = '22023';
  end if;
  -- Serialise code generation per org.
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  insert into public.lots (org_id, product_id, code, qty, supplier, status, order_date, arrival_date)
  values (
    p_org, p_product, private.next_lot_code(p_org, p_product), p_qty,
    coalesce(nullif(btrim(p_supplier), ''), '—'), p_status, current_date,
    case when p_status = 'recebido' then current_date end
  )
  returning id into v_id;
  perform private.set_lot_costs(p_org, v_id, p_costs);
  return v_id;
end;
$$;

create function public.update_lot(
  p_lot uuid, p_product uuid, p_qty integer, p_supplier text, p_status public.lot_status, p_costs jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots%rowtype;
begin
  select * into v_lot from public.lots where id = p_lot for update;
  if not found then
    raise exception 'Lote não encontrado' using errcode = 'P0002';
  end if;
  perform private.require_role(v_lot.org_id, 'Admin', 'Stock');
  if v_lot.status = 'recebido' then
    raise exception 'Lotes recebidos não podem ser editados' using errcode = 'P0001';
  end if;
  update public.lots set
    product_id = p_product,
    qty = p_qty,
    supplier = coalesce(nullif(btrim(p_supplier), ''), '—'),
    status = p_status,
    arrival_date = case when p_status = 'recebido' then coalesce(arrival_date, current_date) end
  where id = p_lot;
  perform private.set_lot_costs(v_lot.org_id, p_lot, p_costs);
end;
$$;

create function public.advance_lot(p_lot uuid)
returns public.lot_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots%rowtype;
  v_next public.lot_status;
begin
  select * into v_lot from public.lots where id = p_lot for update;
  if not found then
    raise exception 'Lote não encontrado' using errcode = 'P0002';
  end if;
  perform private.require_role(v_lot.org_id, 'Admin', 'Stock');
  v_next := case v_lot.status when 'encomendado' then 'transito'::public.lot_status when 'transito' then 'recebido'::public.lot_status end;
  if v_next is null then
    raise exception 'O lote já foi recebido' using errcode = 'P0001';
  end if;
  update public.lots set status = v_next, arrival_date = case when v_next = 'recebido' then current_date end where id = p_lot;
  return v_next;
end;
$$;

/**
 * Record a sale at the product's current price. Goods are drawn FIFO across
 * received lots (oldest arrival first) with row locks, so concurrent sellers
 * can never oversell. Returns the id of the first sale row (attachments go there).
 */
create function public.record_sale(p_org uuid, p_product uuid, p_qty integer, p_customer text, p_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_price numeric;
  v_left integer := p_qty;
  v_take integer;
  v_first uuid;
  v_id uuid;
  v_avail integer := 0;
  v_name text := private.my_name();
  v_uid uuid := (select auth.uid());
  r record;
begin
  perform private.require_role(p_org, 'Admin', 'Vendas');
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;
  if p_date is null or p_date > current_date then
    raise exception 'A data não pode ser no futuro' using errcode = '22023';
  end if;
  select * into v_product from public.products where id = p_product and org_id = p_org;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;
  select price into v_price from public.price_history where product_id = p_product order by effective_at desc, id desc limit 1;
  if coalesce(v_price, 0) <= 0 then
    raise exception 'O produto não tem preço de venda' using errcode = '22023';
  end if;

  if v_product.is_service then
    insert into public.sales (org_id, product_id, lot_id, qty, price, customer, date, sold_by, sold_by_name)
    values (p_org, p_product, null, p_qty, v_price, btrim(coalesce(p_customer, '')), p_date, v_uid, v_name)
    returning id into v_first;
    return v_first;
  end if;

  -- Lock this product's received lots so concurrent sales queue up here.
  perform 1 from public.lots where product_id = p_product and status = 'recebido' for update;

  for r in
    select l.id, l.qty - l.lost - coalesce((select sum(s.qty) from public.sales s where s.lot_id = l.id), 0) as left_qty
    from public.lots l
    where l.product_id = p_product and l.status = 'recebido'
    order by l.arrival_date, l.created_at
  loop
    continue when r.left_qty <= 0;
    v_avail := v_avail + r.left_qty;
    exit when v_left <= 0;
    v_take := least(v_left, r.left_qty);
    insert into public.sales (org_id, product_id, lot_id, qty, price, customer, date, sold_by, sold_by_name)
    values (p_org, p_product, r.id, v_take, v_price, btrim(coalesce(p_customer, '')), p_date, v_uid, v_name)
    returning id into v_id;
    v_first := coalesce(v_first, v_id);
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    raise exception 'Stock insuficiente: % disponíveis', v_avail using errcode = 'P0001';
  end if;
  return v_first;
end;
$$;

-- Functions are callable only by signed-in users.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ── Storage: attachments bucket, files under <org_id>/… ────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 3145728)
on conflict (id) do nothing;

create policy "attachments bucket: members read" on storage.objects for select to authenticated
using (bucket_id = 'attachments' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy "attachments bucket: admin/vendas upload" on storage.objects for insert to authenticated
with check (bucket_id = 'attachments' and private.has_role(((storage.foldername(name))[1])::uuid, 'Admin', 'Vendas'));
create policy "attachments bucket: admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'attachments' and private.has_role(((storage.foldername(name))[1])::uuid, 'Admin'));
