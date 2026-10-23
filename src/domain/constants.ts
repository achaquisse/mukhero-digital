import type { Currency, LotStatus, Role } from './types';

export const COLORS = {
  ink: '#111418',
  muted: '#6B7280',
  green: '#15803D',
  red: '#B42318',
  brand: '#5B4CF5',
  amber: '#B45309',
} as const;

/** Background tint / foreground pairs used for stat icons. */
export const TINTS: ReadonlyArray<readonly [string, string]> = [
  ['#EFEDFF', '#5B4CF5'],
  ['#E7F8EF', '#12B76A'],
  ['#FFF1E6', '#F2994A'],
  ['#E6F6FB', '#0891B2'],
];

export const PALETTE = ['#5B4CF5', '#F2994A', '#12B76A', '#9E77ED', '#F04438', '#EAAA08', '#06AED4', '#98A2B3'];

export interface StatusMeta {
  label: string;
  bg: string;
  color: string;
  dot: string;
}

export const LOT_STATUS: Record<LotStatus, StatusMeta> = {
  encomendado: { label: 'Encomendado', bg: '#FFF4E5', color: '#B45309', dot: '#F2994A' },
  transito: { label: 'Em trânsito', bg: '#EEF3FF', color: '#1D4FD8', dot: '#5B4CF5' },
  recebido: { label: 'Em venda', bg: '#ECFDF3', color: '#15803D', dot: '#12B76A' },
  esgotado: { label: 'Esgotado', bg: '#F2F4F7', color: '#4B5563', dot: '#98A2B3' },
};

export const LOT_STATUSES = Object.keys(LOT_STATUS) as LotStatus[];

/** Next step in a lot's lifecycle, with the action label and icon. */
export const LOT_NEXT: Partial<Record<LotStatus, { to: LotStatus; label: string; icon: string }>> = {
  encomendado: { to: 'transito', label: 'Marcar em trânsito', icon: 'local_shipping' },
  transito: { to: 'recebido', label: 'Marcar como recebido', icon: 'inventory' },
};

export const ROLES: Role[] = ['Admin', 'Vendas', 'Stock', 'Leitura'];

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Admin: 'Acesso total, incluindo equipa e definições.',
  Vendas: 'Regista vendas e consulta stock.',
  Stock: 'Gere produtos, lotes e stock.',
  Leitura: 'Apenas consulta painéis e relatórios.',
};

export const CURRENCIES: Currency[] = ['MT', 'USD', 'ZAR'];

export const CURRENCY_LABELS: Record<Currency, string> = {
  MT: 'Metical (MT)',
  USD: 'Dólar americano (USD)',
  ZAR: 'Rand sul-africano (ZAR)',
};

export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const FILE_ACCEPT = 'image/*,application/pdf,.csv,.txt,.xls,.xlsx';

/** Display fallback for expenses whose category was removed. */
export const NO_CATEGORY = { name: 'Sem categoria', color: '#98A2B3' } as const;
