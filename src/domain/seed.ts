import type { LedgerRow, LotSource } from '../data/bestsound-data';
import { PALETTE } from './constants';
import { currentPrice } from './derive';
import { addDays, addMonths } from './format';
import { uid } from './id';
import type { ExpenseCategory, Lot, Member, OrgData, PriceEntry, Product, Role, Sale, Settings, User } from './types';

/** Stand-in identity until a real Google sign-in is wired up. */
export const DEMO_USER: User = { id: 'u-carlos', name: 'Carlos Machava', email: 'carlos@bestsound.co.mz', initials: 'CM' };

export const asMember = (u: User, role: Role): Member => ({
  userId: u.id,
  name: u.name,
  email: u.email,
  initials: u.initials,
  role,
});

const defaultSettings = (margin = 35): Settings => ({ currency: 'MT', fx: 64, margin, minStock: 5 });

export const defaultCategories = (): ExpenseCategory[] =>
  ['Renda', 'Transporte', 'Taxas bancárias', 'Salários', 'Marketing', 'Outros'].map((name, i) => ({
    id: `c${i}`,
    name,
    color: PALETTE[i % PALETTE.length]!,
  }));

export const emptyOrgData = (user: User = DEMO_USER): OrgData => ({
  settings: defaultSettings(),
  types: [{ id: uid(), name: 'Geral' }],
  cats: defaultCategories(),
  products: [],
  lots: [],
  sales: [],
  expenses: [],
  members: [asMember(user, 'Admin')],
  joinReqs: [],
  invites: [],
});

/** Collapse a product's sales into a price history (one entry per price change). */
function historyFromSales(sales: Sale[], price: number, start: string): PriceEntry[] {
  const out: PriceEntry[] = [];
  for (const s of sales.toSorted((a, b) => a.date.localeCompare(b.date)))
    if (!out.length || out[out.length - 1]!.price !== s.price) out.push({ price: s.price, from: s.date, by: '' });
  return out.length ? out : [{ price, from: start, by: '' }];
}

/** Give seeded sales a plausible seller and time of day. */
function stampSales(list: Sale[], members: Member[]) {
  list.forEach((s, i) => {
    s.soldBy ??= members[i % members.length]!.name;
    s.soldAt ??= `${s.date}T${String(9 + ((i * 7) % 9)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}:00`;
  });
}

/** Physical lot sizes from the spreadsheet (sales rows don't always cover unsold stock). */
const LOT_SIZES: Record<string, Record<string, number>> = {
  Alarmes: { 'Lote 2': 50, 'Lote 3': 60, 'Lote 4': 60, 'Lote 5': 60, 'Lote 6': 100, 'Lote 7': 60, 'Lote 8': 60 },
  GPS: { 'Lote 1': 10, 'Lote 2': 30, 'Lote 3': 30, 'Lote 4': 30 },
  Rádios: { 'Lote 1': 15 },
};

/** Map a ledger category to one of the seeded expense categories. */
const catFor = (raw: string) => {
  const c = raw.toLowerCase();
  if (/bank|banco/.test(c)) return 'c0';
  if (/subs/.test(c)) return 'c1';
  if (c === 'aeu' || c === 'aag' || /viatura/.test(c)) return 'c2';
  if (/divida|dívida/.test(c)) return 'c3';
  return 'c6';
};
/** Ledger lines already accounted for as lot costs or product sales. */
const isStockMovement = (c: string) => /import|shipping|frete|alarm|gps|radio|rádio|\(5\)/.test(c.toLowerCase());

export function seedBestSound(src: { LOTS: LotSource[]; LEDGER: LedgerRow[] }, today: string, user = DEMO_USER): OrgData {
  const types = [
    { id: 't1', name: 'Segurança' },
    { id: 't2', name: 'Rastreamento' },
    { id: 't3', name: 'Áudio' },
    { id: 't4', name: 'Serviços' },
  ];
  const products: Product[] = [
    { id: 'p1', name: 'Alarme auto', sku: 'ALM-01', typeId: 't1', icon: 'shield', minStock: 10, price: 0, priceHistory: [] },
    {
      id: 'p2',
      name: 'Rastreador GPS',
      sku: 'GPS-01',
      typeId: 't2',
      icon: 'location_on',
      minStock: 5,
      price: 0,
      priceHistory: [],
    },
    { id: 'p3', name: 'Rádio auto', sku: 'RAD-01', typeId: 't3', icon: 'radio', minStock: 3, price: 0, priceHistory: [] },
    {
      id: 'p4',
      name: 'Licença GPS',
      sku: 'SRV-GPS',
      typeId: 't4',
      icon: 'key',
      minStock: 0,
      price: 1500,
      service: true,
      priceHistory: [],
    },
  ];
  const productFor = { Alarmes: 'p1', GPS: 'p2', Rádios: 'p3' } as const;
  const codeFor = { Alarmes: 'ALM', GPS: 'GPS', Rádios: 'RAD' } as const;
  const costOverrides: Record<string, Array<[string, number]>> = {
    'Rádios|Lote 1': [
      ['Importação', -47250],
      ['Frete', -2080],
    ],
  };

  const lots: Lot[] = [];
  const sales: Sale[] = [];
  for (const l of src.LOTS) {
    const pid = productFor[l.product];
    const id = `L${lots.length}`;
    const sold = l.sales.filter((s) => s[1] > 0);
    const lost = l.sales.filter((s) => s[1] === 0 && /write/i.test(s[2] || '')).length;
    const qty = Math.max(LOT_SIZES[l.product]?.[l.lot] ?? sold.length, sold.length + lost);
    const costs = (costOverrides[`${l.product}|${l.lot}`] ?? l.costs)
      .filter(([label, v]) => v < 0 && !(label === '' && l.product === 'GPS'))
      .map(([label, v]) => ({ label: label || 'Fornecedor', value: -v }));
    const arrival = sold.map((s) => s[0]).toSorted()[0] ?? today;
    sold.forEach((s, i) =>
      sales.push({ id: `${id}s${i}`, date: s[0], productId: pid, lotId: id, qty: 1, price: s[1], customer: s[2] || '' }),
    );
    lots.push({
      id,
      code: `${codeFor[l.product]}-${l.lot.replace('Lote ', 'L')}`,
      productId: pid,
      qty,
      lost,
      supplier: l.product === 'Rádios' ? 'Guangzhou AutoAudio' : 'Shenzhen SecureTech',
      status: qty - lost - sold.length > 0 ? 'recebido' : 'esgotado',
      orderDate: addDays(arrival, -35),
      arrivalDate: arrival,
      costs,
    });
  }

  for (const p of products) {
    if (p.service) continue;
    const s = sales.filter((x) => x.productId === p.id).toSorted((a, b) => a.date.localeCompare(b.date));
    if (s.length) p.price = s[s.length - 1]!.price;
  }

  const lastAlarm = lots.toReversed().find((l) => l.productId === 'p1');
  if (lastAlarm)
    lots.push({
      id: `L${lots.length}`,
      code: 'ALM-L9',
      productId: 'p1',
      qty: 60,
      lost: 0,
      supplier: 'Shenzhen SecureTech',
      status: 'transito',
      orderDate: addDays(today, -18),
      arrivalDate: null,
      costs: lastAlarm.costs.map((c) => ({ ...c })),
    });
  lots.push({
    id: `L${lots.length}`,
    code: 'GPS-L5',
    productId: 'p2',
    qty: 30,
    lost: 0,
    supplier: 'Shenzhen SecureTech',
    status: 'encomendado',
    orderDate: addDays(today, -4),
    arrivalDate: null,
    costs: [
      { label: 'Fornecedor', value: 30 * 24 * 64 },
      { label: 'Frete', value: 3200 },
    ],
  });

  const cats = ['Taxas bancárias', 'Subsídios', 'Viatura', 'Dívidas', 'Renda', 'Marketing', 'Outros'].map((name, i) => ({
    id: `c${i}`,
    name,
    color: PALETTE[i % PALETTE.length]!,
  }));
  const expenses = [];
  for (const [i, [date, v, cat, note]] of src.LEDGER.entries()) {
    if (v > 0 && /licen|renov/i.test(cat))
      sales.push({ id: `sv${i}`, date, productId: 'p4', lotId: null, qty: 1, price: v, customer: note || '' });
    if (v < 0 && !isStockMovement(cat))
      expenses.push({ id: `e${i}`, date, amount: -v, catId: catFor(cat), note: note || cat || '' });
  }

  const members: Member[] = [
    asMember(user, 'Admin'),
    { userId: 'u-ana', name: 'Ana Sitoe', email: 'ana@bestsound.co.mz', initials: 'AS', role: 'Vendas' },
    { userId: 'u-rui', name: 'Rui Tembe', email: 'rui@bestsound.co.mz', initials: 'RT', role: 'Stock' },
  ];
  for (const p of products) {
    const ps = sales.filter((s) => s.productId === p.id);
    p.priceHistory = historyFromSales(ps, p.price, today).map((e) => ({ ...e, by: user.name }));
    p.price = currentPrice(p);
  }
  stampSales(sales, members);

  return {
    settings: defaultSettings(35),
    types,
    cats,
    products,
    lots,
    sales,
    expenses,
    members,
    joinReqs: [{ id: 'jr1', userId: 'u-helio', name: 'Hélio Mabunda', email: 'helio.mabunda@gmail.com' }],
    invites: [{ id: 'iv1', email: 'contabilidade@bestsound.co.mz', role: 'Leitura' }],
  };
}

/** Small synthetic lighting shop with deterministic pseudo-random sales. */
export function seedCasaLumi(today: string, user = DEMO_USER): OrgData {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const types = [
    { id: 't1', name: 'Iluminação' },
    { id: 't2', name: 'Eléctrico' },
  ];
  // [id, name, sku, typeId, icon, minStock, price, lotQty, unitCost]
  const P = [
    ['p1', 'Candeeiro LED', 'LED-CD', 't1', 'lightbulb', 8, 1200, 40, 520],
    ['p2', 'Extensão 5 m', 'EXT-5', 't2', 'power', 10, 450, 60, 190],
    ['p3', 'Lâmpada 9 W', 'LMP-9', 't1', 'emoji_objects', 40, 120, 200, 45],
  ] as const;
  const start = addDays(today, -110);
  const members: Member[] = [
    { userId: 'u-lucia', name: 'Lúcia Nhantumbo', email: 'lucia@casalumi.co.mz', initials: 'LN', role: 'Admin' },
    asMember(user, 'Vendas'),
  ];
  const products: Product[] = P.map((p) => ({
    id: p[0],
    name: p[1],
    sku: p[2],
    typeId: p[3],
    icon: p[4],
    minStock: p[5],
    price: p[6],
    priceHistory: [{ price: p[6], from: start, by: members[0]!.name }],
  }));
  const lots: Lot[] = P.map((p, i) => ({
    id: `L${i}`,
    code: `${p[2]}-L1`,
    productId: p[0],
    qty: p[7],
    lost: 0,
    supplier: 'Yiwu Lighting Co.',
    status: 'recebido',
    orderDate: addDays(start, -30),
    arrivalDate: start,
    costs: [
      { label: 'Fornecedor', value: Math.round(p[7] * p[8] * 0.8) },
      { label: 'Frete', value: Math.round(p[7] * p[8] * 0.12) },
      { label: 'Alfândega', value: Math.round(p[7] * p[8] * 0.08) },
    ],
  }));
  const left: number[] = P.map((p) => p[7]);
  const sales: Sale[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const n = Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const i = Math.floor(rand() * 3);
      const q = Math.min(left[i]!, 1 + Math.floor(rand() * (i === 2 ? 6 : 2)));
      if (q <= 0) continue;
      left[i]! -= q;
      sales.push({ id: uid(), date: d, productId: P[i]![0], lotId: `L${i}`, qty: q, price: P[i]![6], customer: '' });
    }
  }
  const expenses = [];
  for (let k = start.slice(0, 7); k <= today.slice(0, 7); k = addMonths(k, 1)) {
    expenses.push({ id: uid(), date: `${k}-05`, amount: 6000, catId: 'c0', note: 'Renda da loja' });
    expenses.push({ id: uid(), date: `${k}-18`, amount: 800 + Math.round(rand() * 1200), catId: 'c1', note: 'Chapa e entregas' });
  }
  stampSales(sales, members);
  return {
    settings: defaultSettings(40),
    types,
    cats: defaultCategories(),
    products,
    lots,
    sales,
    expenses: expenses.filter((x) => x.date <= today),
    members,
    joinReqs: [],
    invites: [],
  };
}
