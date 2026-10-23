import type { ExpenseInput, LotInput, ProductEdit, ProductInput } from '../domain/mutations';
import type { Attachment, Currency, IncomingInvite, Org, OrgData, OutgoingRequest, Role, User } from '../domain/types';

export type AttachTarget = { kind: 'sale' | 'expense'; id: string };

export interface SaleRequest {
  productId: string;
  qty: number;
  customer: string;
  date: string;
}

/**
 * Everything the UI needs from a backend. Errors are thrown as `Error`s whose
 * message is user-facing (Portuguese) text.
 */
export interface Api {
  // Auth
  currentUser(): Promise<User | null>;
  onAuthChange(cb: (user: User | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  // Organisations (current user's view)
  listMyOrgs(): Promise<Org[]>;
  listMyInvites(): Promise<IncomingInvite[]>;
  listMyJoinRequests(): Promise<OutgoingRequest[]>;
  createOrg(name: string, color: string): Promise<string>;
  /** Returns the org name. */
  requestJoin(code: string): Promise<string>;
  acceptInvite(inviteId: string): Promise<string>;
  declineInvite(inviteId: string): Promise<void>;

  // One org's data
  loadOrg(orgId: string): Promise<OrgData>;
  updateOrg(orgId: string, patch: { name: string; currency: Currency }): Promise<void>;
  deleteOrg(orgId: string): Promise<void>;

  /** Returns the id of the (first) sale row created. */
  recordSale(orgId: string, sale: SaleRequest): Promise<string>;
  voidSale(saleId: string): Promise<void>;
  addExpense(orgId: string, x: Omit<ExpenseInput, 'files'>): Promise<string>;
  deleteExpense(expenseId: string): Promise<void>;

  uploadAttachments(orgId: string, target: AttachTarget, files: File[]): Promise<void>;
  removeAttachment(file: Attachment): Promise<void>;
  /** Short-lived URL to view (or, with `download`, save) a stored file. */
  attachmentUrl(file: Attachment, opts?: { download?: boolean }): Promise<string>;

  createLot(orgId: string, lot: LotInput): Promise<string>;
  updateLot(lotId: string, lot: LotInput): Promise<void>;
  advanceLot(lotId: string): Promise<void>;

  createProduct(orgId: string, p: ProductInput): Promise<string>;
  updateProduct(productId: string, p: ProductEdit): Promise<void>;
  setPrice(productId: string, price: number): Promise<void>;
  removeProduct(productId: string): Promise<void>;

  addType(orgId: string, name: string): Promise<void>;
  removeType(typeId: string): Promise<void>;
  /** Returns the new category id. */
  addCategory(orgId: string, name: string, color: string): Promise<string>;
  removeCategory(catId: string): Promise<void>;

  inviteMember(orgId: string, email: string, role: Role): Promise<void>;
  cancelInvite(inviteId: string): Promise<void>;
  approveJoin(requestId: string): Promise<void>;
  denyJoin(requestId: string): Promise<void>;
  setMemberRole(orgId: string, userId: string, role: Role): Promise<void>;
  removeMember(orgId: string, userId: string): Promise<void>;
}
