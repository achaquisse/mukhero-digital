/**
 * In-memory implementation of {@link Api} built on the pure domain mutations.
 * Used by UI tests and by the offline demo mode (VITE_API=memory). It mirrors
 * the server's business rules but does not enforce role permissions.
 */
import { PALETTE } from '../domain/constants';
import { deriveOrg } from '../domain/derive';
import { initials, todayISO } from '../domain/format';
import { uid } from '../domain/id';
import * as M from '../domain/mutations';
import { asMember, DEMO_USER, emptyOrgData } from '../domain/defaults';
import type { Attachment, IncomingInvite, Org, OrgData, OutgoingRequest, User } from '../domain/types';
import type { Api } from './types';

type OrgMeta = Omit<Org, 'role'>;

export interface MemoryState {
  user: User | null;
  orgs: OrgMeta[];
  db: Record<string, OrgData>;
  invitesIn: IncomingInvite[];
  requestsOut: OutgoingRequest[];
  files: Map<string, Blob>;
}

export function demoState(): MemoryState {
  return {
    user: null,
    orgs: [{ id: 'o1', name: 'Mukhero Digital', color: '#5B4CF5', joinCode: 'MUKHERO1' }],
    invitesIn: [],
    requestsOut: [],
    db: { o1: emptyOrgData(DEMO_USER) },
    files: new Map(),
  };
}

export interface MemoryApi extends Api {
  readonly state: MemoryState;
}

export function createMemoryApi(state: MemoryState = demoState(), opts: { latencyMs?: number } = {}): MemoryApi {
  const listeners = new Set<(u: User | null) => void>();
  const wait = () => new Promise<void>((r) => setTimeout(r, opts.latencyMs ?? 0));
  const me = () => {
    if (!state.user) throw new Error('Sessão inválida');
    return state.user;
  };
  const actor = (): M.Actor => ({ id: me().id, name: me().name, now: new Date().toISOString(), today: todayISO() });

  const orgOf = (pred: (d: OrgData) => boolean): string => {
    const id = Object.keys(state.db).find((k) => pred(state.db[k]!));
    if (!id) throw new Error('Registo não encontrado');
    return id;
  };
  /** Apply a mutation to one org, throwing on domain errors. */
  const apply = (orgId: string, fn: (d: OrgData) => OrgData | M.Result) => {
    const cur = state.db[orgId];
    if (!cur) throw new Error('Organização não encontrada');
    const r = fn(cur);
    if ('ok' in r) {
      if (!r.ok) throw new Error(r.error);
      state.db[orgId] = r.db;
    } else state.db[orgId] = r;
  };
  const roleIn = (orgId: string) => state.db[orgId]?.members.find((m) => m.userId === state.user?.id)?.role;
  const setUser = (u: User | null) => {
    state.user = u;
    listeners.forEach((l) => l(u));
  };

  const api: MemoryApi = {
    state,
    async currentUser() {
      return state.user;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signInWithGoogle() {
      await wait();
      setUser(DEMO_USER);
    },
    async signInWithPassword(email) {
      await wait();
      if (email.toLowerCase() !== DEMO_USER.email) throw new Error('Email ou palavra-passe incorretos');
      setUser(DEMO_USER);
    },
    async signOut() {
      setUser(null);
    },

    async listMyOrgs() {
      return state.orgs.flatMap((o) => {
        const role = roleIn(o.id);
        return role ? [{ ...o, role, members: state.db[o.id]!.members.length }] : [];
      });
    },
    async listMyInvites() {
      return [...state.invitesIn];
    },
    async listMyJoinRequests() {
      return [...state.requestsOut];
    },
    async createOrg(name, color) {
      await wait();
      const id = `o${uid()}`;
      state.orgs.push({ id, name: name.trim(), color, joinCode: uid().slice(0, 8).toUpperCase() });
      state.db[id] = emptyOrgData(me());
      return id;
    },
    async requestJoin(code) {
      const org = state.orgs.find((o) => o.joinCode === code.trim().toUpperCase());
      if (!org) throw new Error('Código de convite inválido');
      state.requestsOut.push({ id: uid(), org: org.name });
      return org.name;
    },
    async acceptInvite(inviteId) {
      const inv = state.invitesIn.find((i) => i.id === inviteId);
      if (!inv) throw new Error('Convite não encontrado');
      const id = `o${uid()}`;
      state.orgs.push({ id, name: inv.org, color: PALETTE[state.orgs.length % PALETTE.length]!, joinCode: uid().slice(0, 8) });
      const by: User = { id: `u-${uid()}`, name: inv.by, email: '', initials: initials(inv.by) };
      state.db[id] = { ...emptyOrgData(by), members: [asMember(by, 'Admin'), asMember(me(), inv.role)] };
      state.invitesIn = state.invitesIn.filter((i) => i.id !== inviteId);
      return id;
    },
    async declineInvite(inviteId) {
      state.invitesIn = state.invitesIn.filter((i) => i.id !== inviteId);
    },

    async loadOrg(orgId) {
      await wait();
      const d = state.db[orgId];
      if (!d) throw new Error('Organização não encontrada');
      return structuredClone(d);
    },
    async updateOrg(orgId, { name, currency }) {
      const o = state.orgs.find((x) => x.id === orgId);
      if (o) o.name = name.trim();
      apply(orgId, (d) => M.setCurrency(d, currency));
    },
    async deleteOrg(orgId) {
      state.orgs = state.orgs.filter((o) => o.id !== orgId);
      delete state.db[orgId];
    },

    async recordSale(orgId, s) {
      await wait();
      const before = new Set(state.db[orgId]?.sales.map((x) => x.id));
      apply(orgId, (d) => M.recordSale(d, deriveOrg(d, todayISO()), { ...s, files: [] }, actor()));
      return state.db[orgId]!.sales.find((x) => !before.has(x.id))!.id;
    },
    async voidSale(saleId) {
      apply(
        orgOf((d) => d.sales.some((s) => s.id === saleId)),
        (d) => M.voidSale(d, saleId),
      );
    },
    async addExpense(orgId, x) {
      await wait();
      apply(orgId, (d) => M.addExpense(d, { ...x, files: [] }, actor()));
      return state.db[orgId]!.expenses.at(-1)!.id;
    },
    async deleteExpense(id) {
      apply(
        orgOf((d) => d.expenses.some((x) => x.id === id)),
        (d) => M.deleteExpense(d, id),
      );
    },

    async uploadAttachments(orgId, target, files) {
      const atts: Attachment[] = files.map((f) => {
        const path = `${orgId}/${uid()}-${f.name}`;
        state.files.set(path, f);
        return {
          id: uid(),
          name: f.name,
          type: f.type,
          size: f.size,
          path,
          addedAt: new Date().toISOString(),
          addedBy: me().name,
        };
      });
      apply(orgId, (d) => M.addAttachments(d, target, atts));
    },
    async removeAttachment(file) {
      const orgId = file.path.split('/')[0]!;
      apply(orgId, (d) => {
        const target: M.AttachTarget = d.sales.some((s) => s.files?.some((f) => f.id === file.id))
          ? { kind: 'sale', id: d.sales.find((s) => s.files?.some((f) => f.id === file.id))!.id }
          : { kind: 'expense', id: d.expenses.find((x) => x.files?.some((f) => f.id === file.id))?.id ?? '' };
        return M.removeAttachment(d, target, file.id);
      });
      state.files.delete(file.path);
    },
    async attachmentUrl(file) {
      const blob = state.files.get(file.path);
      if (!blob) throw new Error('Não foi possível abrir o ficheiro');
      return URL.createObjectURL(blob);
    },

    async createLot(orgId, lot) {
      const r = M.createLot(state.db[orgId]!, lot, todayISO());
      apply(orgId, () => r);
      return r.lotId!;
    },
    async updateLot(lotId, lot) {
      apply(
        orgOf((d) => d.lots.some((l) => l.id === lotId)),
        (d) => M.updateLot(d, lotId, lot, todayISO()),
      );
    },
    async advanceLot(lotId) {
      const orgId = orgOf((d) => d.lots.some((l) => l.id === lotId));
      const L = state.db[orgId]!.lots.find((l) => l.id === lotId)!;
      const to = L.status === 'encomendado' ? 'transito' : L.status === 'transito' ? 'recebido' : null;
      if (!to) throw new Error('O lote já foi recebido');
      apply(orgId, (d) => M.advanceLot(d, lotId, to, todayISO()));
    },
    async setLotQty(lotId, qty) {
      apply(
        orgOf((d) => d.lots.some((l) => l.id === lotId)),
        (d) => M.setLotQty(d, lotId, qty),
      );
    },

    async createProduct(orgId, p) {
      if (p.sku && M.skuTakenIn(state.db[orgId]!)(p.sku)) throw new Error('Já existe um produto com este código');
      apply(orgId, (d) => M.addProduct(d, p, actor()));
      return state.db[orgId]!.products.at(-1)!.id;
    },
    async updateProduct(id, p) {
      apply(
        orgOf((d) => d.products.some((x) => x.id === id)),
        (d) => M.updateProduct(d, id, p),
      );
    },
    async setPrice(id, price) {
      apply(
        orgOf((d) => d.products.some((x) => x.id === id)),
        (d) => M.setPrice(d, id, price, actor()),
      );
    },
    async removeProduct(id) {
      apply(
        orgOf((d) => d.products.some((x) => x.id === id)),
        (d) => M.removeProduct(d, id),
      );
    },

    async addType(orgId, name) {
      apply(orgId, (d) => M.addType(d, name));
    },
    async removeType(id) {
      apply(
        orgOf((d) => d.types.some((t) => t.id === id)),
        (d) => M.removeType(d, id),
      );
    },
    async addCategory(orgId, name, color) {
      const r = M.addCategory(state.db[orgId]!, name, color);
      apply(orgId, () => r);
      return r.id!;
    },
    async removeCategory(id) {
      apply(
        orgOf((d) => d.cats.some((c) => c.id === id)),
        (d) => M.removeCategory(d, id),
      );
    },

    async inviteMember(orgId, email, role) {
      apply(orgId, (d) => M.invite(d, email, role));
    },
    async cancelInvite(id) {
      apply(
        orgOf((d) => d.invites.some((i) => i.id === id)),
        (d) => M.cancelInvite(d, id),
      );
    },
    async approveJoin(id) {
      const orgId = orgOf((d) => d.joinReqs.some((r) => r.id === id));
      apply(orgId, (d) =>
        M.approveJoin(
          d,
          d.joinReqs.find((r) => r.id === id)!,
        ),
      );
    },
    async denyJoin(id) {
      apply(
        orgOf((d) => d.joinReqs.some((r) => r.id === id)),
        (d) => M.denyJoin(d, id),
      );
    },
    async setMemberRole(orgId, userId, role) {
      apply(orgId, (d) => M.setMemberRole(d, userId, role));
    },
    async removeMember(orgId, userId) {
      apply(orgId, (d) => M.removeMember(d, userId));
    },
  };
  return api;
}
