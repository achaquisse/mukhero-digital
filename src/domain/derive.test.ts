import { describe, expect, it } from 'vitest';
import { lot, makeDb, sale, TODAY } from '../test/fixtures';
import { allocateFifo, deriveOrg, estimateSaleCost } from './derive';

describe('deriveOrg', () => {
  it('computes landed cost, units left and profit per lot', () => {
    const db = makeDb({
      sales: [sale({ id: 's1', productId: 'p1', lotId: 'A', qty: 2, price: 100 })],
      lots: [
        lot({
          id: 'A',
          productId: 'p1',
          qty: 5,
          lost: 1,
          costs: [
            { label: 'x', value: 200 },
            { label: 'y', value: 50 },
          ],
        }),
      ],
    });
    const A = deriveOrg(db, TODAY).lotById.A!;
    expect(A.cost).toBe(250);
    expect(A.unit).toBe(50);
    expect(A.sold).toBe(2);
    expect(A.left).toBe(2); // 5 − 1 lost − 2 sold
    expect(A.rev).toBe(200);
    expect(A.profit).toBe(-50);
  });

  it('only counts stock from received lots; others are in transit', () => {
    const db = makeDb({
      lots: [
        lot({ id: 'A', productId: 'p1', qty: 5 }),
        lot({ id: 'T', productId: 'p1', qty: 8, status: 'transito', arrivalDate: null }),
      ],
    });
    const p1 = deriveOrg(db, TODAY).productById.p1!;
    expect(p1.onHand).toBe(5);
    expect(p1.transit).toBe(8);
  });

  it('values product unit cost from stock on hand and computes margin', () => {
    const p1 = deriveOrg(makeDb(), TODAY).productById.p1!;
    // 5 × 50 + 10 × 60 = 850 for 15 units
    expect(p1.unitCost).toBeCloseTo(850 / 15);
    expect(p1.gpU).toBeCloseTo(100 - 850 / 15);
    expect(p1.marginP).toBeCloseTo(((100 - 850 / 15) / 100) * 100);
  });

  it('lists available lots oldest-arrival first', () => {
    const d = deriveOrg(makeDb(), TODAY);
    const av = d.avail('p1');
    expect(av.lots.map((L) => L.id)).toEqual(['A', 'B']);
    expect(av.total).toBe(15);
  });

  it('uses the current price from the price history', () => {
    const db = makeDb();
    db.products[0]!.priceHistory.push({ price: 140, from: '2026-05-01', by: 'x' });
    expect(deriveOrg(db, TODAY).productById.p1!.price).toBe(140);
  });
});

describe('FIFO', () => {
  it('splits a quantity across lots and reports shortfall', () => {
    const d = deriveOrg(makeDb(), TODAY);
    const { slices, shortfall } = allocateFifo(d.avail('p1'), 7);
    expect(slices).toEqual([
      { lotId: 'A', qty: 5, unitCost: 50 },
      { lotId: 'B', qty: 2, unitCost: 60 },
    ]);
    expect(shortfall).toBe(0);
    expect(allocateFifo(d.avail('p1'), 20).shortfall).toBe(5);
  });

  it('estimates cost of a prospective sale', () => {
    const d = deriveOrg(makeDb(), TODAY);
    expect(estimateSaleCost(d.productById.p1!, d.avail('p1'), 7)).toBe(5 * 50 + 2 * 60);
    expect(estimateSaleCost(d.productById.p2!, null, 3)).toBe(0);
  });
});
