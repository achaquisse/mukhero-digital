import { addDays } from './format';
import type { Lot, OrgData, PriceEntry, Product, Sale } from './types';

export interface LotView extends Lot {
  /** Total landed cost (supplier + freight + customs + other). */
  cost: number;
  /** Landed cost per unit. */
  unit: number;
  sold: number;
  rev: number;
  /** Physically received (in sale or sold out). */
  recv: boolean;
  left: number;
  profit: number;
}

export interface ProductView extends Product {
  typeName: string;
  ph: PriceEntry[];
  onHand: number;
  transit: number;
  stockCost: number;
  unitCost: number;
  /** Gross profit per unit at the current price. */
  gpU: number;
  marginP: number;
  hasCost: boolean;
  /** Units sold over the last 90 days. */
  u90: number;
}

export interface Availability {
  lots: LotView[];
  total: number;
}

export interface Derived {
  lots: LotView[];
  lotById: Record<string, LotView>;
  products: ProductView[];
  productById: Record<string, ProductView>;
  /** Most recently ordered lot for each product. */
  lastLot: Record<string, LotView>;
  cogs: (s: Pick<Sale, 'lotId' | 'qty'>) => number;
  avail: (productId: string) => Availability;
}

export const sum = <T>(list: readonly T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);

export function currentPrice(p: Pick<Product, 'priceHistory' | 'price'>): number {
  const h = p.priceHistory;
  return h.length ? h[h.length - 1]!.price : p.price || 0;
}

export const isReceived = (l: Pick<Lot, 'status'>) => l.status === 'recebido' || l.status === 'esgotado';

export function deriveOrg(db: OrgData, today: string): Derived {
  const lotById: Record<string, LotView> = {};
  for (const l of db.lots) {
    const cost = sum(l.costs, (c) => Number(c.value) || 0);
    lotById[l.id] = { ...l, cost, unit: l.qty ? cost / l.qty : 0, sold: 0, rev: 0, recv: false, left: 0, profit: 0 };
  }
  for (const s of db.sales) {
    const L = s.lotId ? lotById[s.lotId] : undefined;
    if (L) {
      L.sold += s.qty;
      L.rev += s.qty * s.price;
    }
  }
  const lots = Object.values(lotById);
  for (const L of lots) {
    L.recv = isReceived(L);
    L.left = L.recv ? Math.max(0, L.qty - L.lost - L.sold) : 0;
    L.profit = L.rev - L.cost;
  }

  const typeName = (id: string) => db.types.find((t) => t.id === id)?.name ?? '—';
  const productById: Record<string, ProductView> = {};
  for (const p of db.products) {
    productById[p.id] = {
      ...p,
      price: currentPrice(p),
      ph: p.priceHistory.length ? p.priceHistory : [{ price: p.price || 0, from: '', by: '' }],
      typeName: typeName(p.typeId),
      onHand: 0,
      transit: 0,
      stockCost: 0,
      unitCost: 0,
      gpU: 0,
      marginP: 0,
      hasCost: false,
      u90: 0,
    };
  }
  for (const L of lots) {
    const p = productById[L.productId];
    if (!p) continue;
    p.onHand += L.left;
    p.stockCost += L.left * L.unit;
    if (!L.recv) p.transit += L.qty;
  }

  const lastLot: Record<string, LotView> = {};
  for (const L of lots.toSorted((a, b) => a.orderDate.localeCompare(b.orderDate))) lastLot[L.productId] = L;

  const products = Object.values(productById);
  for (const p of products) {
    const ll = lastLot[p.id];
    p.unitCost = p.service ? 0 : p.onHand ? p.stockCost / p.onHand : (ll?.unit ?? 0);
    p.gpU = p.price - p.unitCost;
    p.marginP = p.price ? (p.gpU / p.price) * 100 : 0;
    p.hasCost = !!p.service || p.onHand > 0 || !!ll;
  }

  const d90 = addDays(today, -90);
  for (const s of db.sales) {
    const p = productById[s.productId];
    if (p && s.date >= d90) p.u90 += s.qty;
  }

  const cogs = (s: Pick<Sale, 'lotId' | 'qty'>) => {
    const L = s.lotId ? lotById[s.lotId] : undefined;
    return L ? L.unit * s.qty : 0;
  };

  /** Lots with stock for a product, oldest arrival first (FIFO order). */
  const avail = (productId: string): Availability => {
    const ls = lots
      .filter((L) => L.productId === productId && L.left > 0)
      .toSorted((a, b) => (a.arrivalDate ?? '').localeCompare(b.arrivalDate ?? ''));
    return { lots: ls, total: sum(ls, (L) => L.left) };
  };

  return { lots, lotById, products, productById, lastLot, cogs, avail };
}

export interface FifoSlice {
  lotId: string;
  qty: number;
  unitCost: number;
}

/**
 * Split `qty` across lots in FIFO order. Returns the slices and any shortfall
 * that could not be covered by stock on hand.
 */
export function allocateFifo(av: Availability, qty: number): { slices: FifoSlice[]; shortfall: number } {
  const slices: FifoSlice[] = [];
  let q = qty;
  for (const L of av.lots) {
    if (q <= 0) break;
    const take = Math.min(q, L.left);
    slices.push({ lotId: L.id, qty: take, unitCost: L.unit });
    q -= take;
  }
  return { slices, shortfall: Math.max(0, q) };
}

/** Estimated cost of goods for a prospective sale (FIFO, falling back to the product's unit cost). */
export function estimateSaleCost(p: ProductView, av: Availability | null, qty: number): number {
  if (!av) return 0;
  const { slices, shortfall } = allocateFifo(av, qty);
  return sum(slices, (s) => s.qty * s.unitCost) + shortfall * p.unitCost;
}
