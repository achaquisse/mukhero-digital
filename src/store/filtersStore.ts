import { create } from 'zustand';
import { ALL, DEFAULT_PRESET, type Filters, type RangeState } from '../domain/analytics';

export type StockView = 'lotes' | 'produtos';
export type DashboardMetric = 'rev' | 'gp' | 'un';

interface FiltersState extends Filters {
  stockView: StockView;
  metric: DashboardMetric;
  setRange: (patch: Partial<RangeState>) => void;
  setProduct: (id: string) => void;
  setType: (id: string) => void;
  setCat: (id: string) => void;
  setStockView: (v: StockView) => void;
  setMetric: (m: DashboardMetric) => void;
  clear: () => void;
}

const initial = (): Filters => ({
  range: { preset: DEFAULT_PRESET, from: '', to: '' },
  productId: ALL,
  typeId: ALL,
  catId: ALL,
});

export const useFilters = create<FiltersState>()((set) => ({
  ...initial(),
  stockView: 'lotes',
  metric: 'rev',
  setRange: (patch) => set((s) => ({ range: { ...s.range, ...patch } })),
  setProduct: (productId) => set({ productId }),
  setType: (typeId) => set({ typeId }),
  setCat: (catId) => set({ catId }),
  setStockView: (stockView) => set({ stockView }),
  setMetric: (metric) => set({ metric }),
  clear: () => set(initial()),
}));
