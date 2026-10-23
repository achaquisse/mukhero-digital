/**
 * Generates supabase/seed.sql from the TypeScript demo seeds (BestSound
 * spreadsheet import + synthetic Casa Lumi), plus demo users that can sign in
 * locally with email + password.
 *
 *   npm run db:seed:generate
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import * as data from '../src/data/bestsound-data';
import { todayISO } from '../src/domain/format';
import { seedBestSound, seedCasaLumi } from '../src/domain/seed';
import type { OrgData, User } from '../src/domain/types';

export const DEMO_PASSWORD = 'mukhero-demo';

const USERS: Array<User & { key: string }> = [
  { key: 'carlos', name: 'Carlos Machava', email: 'carlos@bestsound.co.mz', initials: 'CM' },
  { key: 'ana', name: 'Ana Sitoe', email: 'ana@bestsound.co.mz', initials: 'AS' },
  { key: 'rui', name: 'Rui Tembe', email: 'rui@bestsound.co.mz', initials: 'RT' },
  { key: 'lucia', name: 'Lúcia Nhantumbo', email: 'lucia@casalumi.co.mz', initials: 'LN' },
  { key: 'helio', name: 'Hélio Mabunda', email: 'helio.mabunda@gmail.com', initials: 'HM' },
];

/** Deterministic UUID from a namespaced key, so re-generating keeps ids stable. */
const id = (key: string) => {
  const h = createHash('md5').update(`mukhero:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replaceAll("'", "''")}'`);
const n = (v: number | null | undefined) => (v == null ? 'null' : String(v));
const userId = (name: string) => {
  const u = USERS.find((x) => x.name === name);
  return u ? q(id(`user:${u.key}`)) : 'null';
};

function rows(table: string, cols: string[], values: string[][]): string {
  if (!values.length) return '';
  const chunks: string[] = [];
  for (let i = 0; i < values.length; i += 500)
    chunks.push(
      `insert into public.${table} (${cols.join(', ')}) values\n${values
        .slice(i, i + 500)
        .map((v) => `  (${v.join(', ')})`)
        .join(',\n')};`,
    );
  return chunks.join('\n') + '\n';
}

function orgSql(
  key: string,
  name: string,
  color: string,
  joinCode: string,
  db: OrgData,
  members: Array<[string, string]>,
): string {
  const org = id(`org:${key}`);
  const k = (kind: string, local: string) => id(`${key}:${kind}:${local}`);
  const o = q(org);
  const owner = USERS.find((u) => u.key === members[0]![0])!;
  let sql = `\n-- ${name}\n`;
  sql += `insert into public.orgs (id, name, color, currency, fx, default_margin, min_stock, join_code, created_by) values (${o}, ${q(name)}, ${q(color)}, ${q(db.settings.currency)}, ${db.settings.fx}, ${db.settings.margin}, ${db.settings.minStock}, ${q(joinCode)}, ${q(id(`user:${members[0]![0]}`))});\n`;
  sql += rows(
    'memberships',
    ['org_id', 'user_id', 'role'],
    members.map(([u, role]) => [o, q(id(`user:${u}`)), q(role)]),
  );
  sql += rows(
    'product_types',
    ['id', 'org_id', 'name'],
    db.types.map((t) => [q(k('type', t.id)), o, q(t.name)]),
  );
  sql += rows(
    'expense_categories',
    ['id', 'org_id', 'name', 'color'],
    db.cats.map((c) => [q(k('cat', c.id)), o, q(c.name), q(c.color)]),
  );
  sql += rows(
    'products',
    ['id', 'org_id', 'name', 'sku', 'type_id', 'icon', 'min_stock', 'margin', 'is_service'],
    db.products.map((p) => [
      q(k('product', p.id)),
      o,
      q(p.name),
      q(p.sku),
      q(k('type', p.typeId)),
      q(p.icon),
      n(p.minStock),
      n(p.margin ?? null),
      String(!!p.service),
    ]),
  );
  sql += rows(
    'price_history',
    ['org_id', 'product_id', 'price', 'effective_at', 'set_by', 'set_by_name'],
    db.products.flatMap((p) =>
      p.priceHistory.map((h, i) => [
        o,
        q(k('product', p.id)),
        n(h.price),
        q(h.from ? `${h.from.slice(0, 10)}T08:00:${String(i).padStart(2, '0')}Z` : '2024-01-01T00:00:00Z'),
        userId(h.by),
        q(h.by),
      ]),
    ),
  );
  sql += rows(
    'lots',
    ['id', 'org_id', 'product_id', 'code', 'qty', 'lost', 'supplier', 'status', 'order_date', 'arrival_date'],
    db.lots.map((L) => [
      q(k('lot', L.id)),
      o,
      q(k('product', L.productId)),
      q(L.code),
      n(L.qty),
      n(L.lost),
      q(L.supplier),
      q(L.status === 'esgotado' ? 'recebido' : L.status),
      q(L.orderDate),
      q(L.arrivalDate),
    ]),
  );
  sql += rows(
    'lot_costs',
    ['org_id', 'lot_id', 'label', 'value', 'position'],
    db.lots.flatMap((L) => L.costs.map((c, i) => [o, q(k('lot', L.id)), q(c.label), n(c.value), n(i)])),
  );
  sql += rows(
    'sales',
    ['org_id', 'product_id', 'lot_id', 'qty', 'price', 'customer', 'date', 'sold_by', 'sold_by_name', 'sold_at'],
    db.sales.map((s) => [
      o,
      q(k('product', s.productId)),
      s.lotId ? q(k('lot', s.lotId)) : 'null',
      n(s.qty),
      n(s.price),
      q(s.customer),
      q(s.date),
      userId(s.soldBy ?? ''),
      q(s.soldBy ?? ''),
      q(s.soldAt ?? `${s.date}T10:00:00`),
    ]),
  );
  sql += rows(
    'expenses',
    ['org_id', 'category_id', 'amount', 'date', 'note', 'created_by', 'created_by_name', 'created_at'],
    db.expenses.map((x) => [
      o,
      q(k('cat', x.catId)),
      n(x.amount),
      q(x.date),
      q(x.note),
      userId(owner.name),
      q(owner.name),
      q(`${x.date}T09:00:00Z`),
    ]),
  );
  return sql;
}

const today = todayISO();
const demoUser = USERS[0]!;
const best = seedBestSound(data, today, demoUser);
const lumi = seedCasaLumi(today, demoUser);

let sql = `-- GENERATED by scripts/generate-seed.ts on ${today}. Do not edit by hand.
-- Demo users (password: ${DEMO_PASSWORD}): ${USERS.map((u) => u.email).join(', ')}

`;
sql += USERS.map(
  (
    u,
  ) => `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${q(id(`user:${u.key}`))}, 'authenticated', 'authenticated', ${q(u.email)}, extensions.crypt(${q(DEMO_PASSWORD)}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ full_name: u.name }))}, now(), now(), '', '', '', '');
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (${q(id(`user:${u.key}`))}, ${q(id(`user:${u.key}`))}, ${q(JSON.stringify({ sub: id(`user:${u.key}`), email: u.email, email_verified: true }))}, 'email', now(), now(), now());`,
).join('\n');
sql += '\n';

sql += orgSql('bestsound', 'BestSound', '#5B4CF5', 'BESTSND1', best, [
  ['carlos', 'Admin'],
  ['ana', 'Vendas'],
  ['rui', 'Stock'],
]);
sql += orgSql('casalumi', 'Casa Lumi', '#F2994A', 'CASALUMI', lumi, [
  ['lucia', 'Admin'],
  ['carlos', 'Vendas'],
]);

const bs = q(id('org:bestsound'));
sql += `
-- Team activity
insert into public.invites (org_id, email, role, invited_by) values (${bs}, 'contabilidade@bestsound.co.mz', 'Leitura', ${q(id('user:carlos'))});
insert into public.invites (org_id, email, role, invited_by) values (${q(id('org:casalumi'))}, 'rui@bestsound.co.mz', 'Stock', ${q(id('user:lucia'))});
insert into public.join_requests (org_id, user_id) values (${bs}, ${q(id('user:helio'))});
`;

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(`Wrote supabase/seed.sql (${(sql.length / 1024).toFixed(0)} KB)`);
