export type Currency = 'MT' | 'USD' | 'ZAR';
export type Role = 'Admin' | 'Vendas' | 'Stock' | 'Leitura';
export type LotStatus = 'encomendado' | 'transito' | 'recebido' | 'esgotado';

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export interface Org {
  id: string;
  name: string;
  /** The current user's role in this org. */
  role: Role;
  color: string;
  /** Code others use to request access (visible to members). */
  joinCode: string;
  /** Member count, when known. */
  members?: number;
}

export interface Settings {
  currency: Currency;
  /** USD → local currency exchange rate used when costing lots. */
  fx: number;
  /** Default margin (%) used to suggest a selling price. */
  margin: number;
  minStock: number;
}

export interface ProductType {
  id: string;
  name: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

export interface PriceEntry {
  price: number;
  /** ISO date or datetime; empty when unknown. */
  from: string;
  by: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  typeId: string;
  icon: string;
  minStock: number;
  price: number;
  margin?: number;
  service?: boolean;
  priceHistory: PriceEntry[];
}

export interface Cost {
  label: string;
  value: number;
}

export interface Lot {
  id: string;
  code: string;
  productId: string;
  qty: number;
  lost: number;
  supplier: string;
  status: LotStatus;
  orderDate: string;
  arrivalDate: string | null;
  costs: Cost[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Storage object path (`<orgId>/<uuid>-<name>`). */
  path: string;
  addedAt: string;
  addedBy: string;
}

/** A file picked in a form but not uploaded yet. */
export interface DraftFile {
  id: string;
  file: File;
}

export interface Sale {
  id: string;
  date: string;
  productId: string;
  lotId: string | null;
  qty: number;
  price: number;
  customer: string;
  soldBy?: string;
  soldAt?: string;
  files?: Attachment[];
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  catId: string;
  note: string;
  files?: Attachment[];
  createdAt?: string;
  createdBy?: string;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
}

export interface JoinRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
}

export interface IncomingInvite {
  id: string;
  org: string;
  by: string;
  role: Role;
}

export interface OutgoingRequest {
  id: string;
  org: string;
}

export interface OrgData {
  settings: Settings;
  types: ProductType[];
  cats: ExpenseCategory[];
  products: Product[];
  lots: Lot[];
  sales: Sale[];
  expenses: Expense[];
  members: Member[];
  joinReqs: JoinRequest[];
  invites: Invite[];
}
