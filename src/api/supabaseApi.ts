import type { PostgrestError, User as AuthUser } from '@supabase/supabase-js';
import { ORGS_AFTER_SIGN_IN } from '../app/paths';
import { lotCosts } from '../domain/mutations';
import { initials } from '../domain/format';
import type { Role, User } from '../domain/types';
import type { Database, Json } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { toOrg, toOrgData } from './mappers';
import type { Api } from './types';

type Table = keyof Database['public']['Tables'];

const BUCKET = 'attachments';
const PAGE = 1000;

/** Translate database errors into user-facing messages. */
export function toError(e: Pick<PostgrestError, 'code' | 'message' | 'details'>): Error {
  const msg = e.message ?? '';
  if (e.code === '42501' && !/permissão/.test(msg)) return new Error('Sem permissão para esta ação');
  if (/row-level security/i.test(msg)) return new Error('Sem permissão para esta ação');
  if (e.code === '23505') {
    if (/product_types/.test(msg)) return new Error('Já existe um tipo com este nome');
    if (/expense_categories/.test(msg)) return new Error('Já existe uma categoria com este nome');
    if (/products_sku/.test(msg)) return new Error('Já existe um produto com este código');
  }
  if (e.code === '23503' && /products|lots/.test(msg + (e.details ?? '')))
    return new Error('Produto com movimentos não pode ser removido');
  return new Error(msg || 'Ocorreu um erro. Tente novamente.');
}

/** Unwrap a Supabase response, throwing a user-facing error. Void RPCs yield null at runtime. */
function ok<T>(r: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (r.error) throw toError(r.error);
  return r.data as NonNullable<T>;
}

/** Fetch every row of an org's table, paging past PostgREST's row limit. */
async function all<T extends Table>(table: T, orgId: string, order = 'id'): Promise<Database['public']['Tables'][T]['Row'][]> {
  const out: Database['public']['Tables'][T]['Row'][] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = ok(
      await supabase
        .from(table)
        .select('*')
        .eq('org_id' as never, orgId as never)
        .order(order as never)
        .range(from, from + PAGE - 1),
    ) as unknown as Database['public']['Tables'][T]['Row'][];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

function toUser(u: AuthUser): User {
  const name = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || (u.email ?? '').split('@')[0]!;
  const avatar = (u.user_metadata?.avatar_url as string) || (u.user_metadata?.picture as string) || undefined;
  return { id: u.id, name, email: u.email ?? '', initials: initials(name), avatarUrl: avatar };
}

const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .slice(-80);

const lotPayload = (lot: Parameters<Api['createLot']>[1]) => ({
  p_product: lot.productId,
  p_qty: lot.qty,
  p_supplier: lot.supplier,
  p_status: lot.status,
  p_costs: lotCosts(lot) as unknown as Json,
});

export const supabaseApi: Api = {
  async currentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user ? toUser(data.user) : null;
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ? toUser(session.user) : null));
    return () => data.subscription.unsubscribe();
  },
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${ORGS_AFTER_SIGN_IN}` },
    });
    if (error) throw new Error('Não foi possível ligar à Google. Tente novamente.');
  },
  async signInWithPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Email ou palavra-passe incorretos');
  },
  async signOut() {
    await supabase.auth.signOut();
  },

  async listMyOrgs() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    const rows = ok(
      await supabase
        .from('memberships')
        .select('role, orgs(id, name, color, join_code, memberships(count))')
        .eq('user_id', auth.user.id)
        .order('created_at'),
    );
    return rows.flatMap((m) => (m.orgs ? [{ ...toOrg(m.orgs, m.role), members: m.orgs.memberships[0]?.count }] : []));
  },
  async listMyInvites() {
    return ok(await supabase.rpc('my_invites')).map((i) => ({ id: i.id, org: i.org_name, by: i.invited_by_name, role: i.role }));
  },
  async listMyJoinRequests() {
    return ok(await supabase.rpc('my_join_requests')).map((r) => ({ id: r.id, org: r.org_name }));
  },
  async createOrg(name, color) {
    return ok(await supabase.rpc('create_org', { p_name: name, p_color: color }));
  },
  async requestJoin(code) {
    return ok(await supabase.rpc('request_join', { p_code: code }));
  },
  async acceptInvite(id) {
    return ok(await supabase.rpc('accept_invite', { p_invite: id }));
  },
  async declineInvite(id) {
    ok(await supabase.rpc('decline_invite', { p_invite: id }));
  },

  async loadOrg(orgId) {
    const [org, types, cats, products, prices, lots, costs, sales, expenses, attachments, members, invites, joinRequests] =
      await Promise.all([
        supabase.from('orgs').select('*').eq('id', orgId).single().then(ok),
        all('product_types', orgId, 'created_at'),
        all('expense_categories', orgId, 'created_at'),
        all('products', orgId, 'created_at'),
        all('price_history', orgId),
        all('lots', orgId, 'created_at'),
        all('lot_costs', orgId),
        all('sales', orgId, 'sold_at'),
        all('expenses', orgId, 'created_at'),
        all('attachments', orgId, 'added_at'),
        supabase
          .from('memberships')
          .select('user_id, role, profiles(name, email, avatar_url)')
          .eq('org_id', orgId)
          .order('created_at')
          .then(ok),
        supabase.from('invites').select('id, email, role').eq('org_id', orgId).order('created_at').then(ok),
        supabase
          .from('join_requests')
          .select('id, user_id, profiles(name, email)')
          .eq('org_id', orgId)
          .order('created_at')
          .then(ok),
      ]);
    return toOrgData({
      org,
      types,
      cats,
      products,
      prices,
      lots,
      costs,
      sales,
      expenses,
      attachments,
      members,
      invites,
      joinRequests,
    });
  },
  async updateOrg(orgId, { name, currency }) {
    ok(await supabase.from('orgs').update({ name: name.trim(), currency }).eq('id', orgId));
  },
  async deleteOrg(orgId) {
    // Storage objects are not cascaded by the database; remove them first.
    const { data: files } = await supabase.storage.from(BUCKET).list(orgId, { limit: 1000 });
    if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => `${orgId}/${f.name}`));
    ok(await supabase.from('orgs').delete().eq('id', orgId));
  },

  async recordSale(orgId, s) {
    return ok(
      await supabase.rpc('record_sale', {
        p_org: orgId,
        p_product: s.productId,
        p_qty: s.qty,
        p_customer: s.customer,
        p_date: s.date,
      }),
    );
  },
  async voidSale(id) {
    const rows = ok(await supabase.from('sales').delete().eq('id', id).select('id'));
    if (!rows.length) throw new Error('Sem permissão para esta ação');
  },
  async addExpense(orgId, x) {
    const { data: auth } = await supabase.auth.getUser();
    const row = ok(
      await supabase
        .from('expenses')
        .insert({
          org_id: orgId,
          amount: x.amount,
          category_id: x.catId || null,
          date: x.date,
          note: x.note.trim(),
          created_by: auth.user?.id,
          created_by_name: auth.user ? toUser(auth.user).name : '',
        })
        .select('id')
        .single(),
    );
    return row.id;
  },
  async deleteExpense(id) {
    const rows = ok(await supabase.from('expenses').delete().eq('id', id).select('id'));
    if (!rows.length) throw new Error('Sem permissão para esta ação');
  },

  async uploadAttachments(orgId, target, files) {
    const { data: auth } = await supabase.auth.getUser();
    const by = auth.user ? toUser(auth.user) : null;
    for (const f of files) {
      const path = `${orgId}/${crypto.randomUUID()}-${safeName(f.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
      if (up.error) throw new Error(`Não foi possível carregar ${f.name}`);
      const ins = await supabase.from('attachments').insert({
        org_id: orgId,
        sale_id: target.kind === 'sale' ? target.id : null,
        expense_id: target.kind === 'expense' ? target.id : null,
        name: f.name,
        mime: f.type,
        size: f.size,
        storage_path: path,
        added_by: by?.id,
        added_by_name: by?.name ?? '',
      });
      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw toError(ins.error);
      }
    }
  },
  async removeAttachment(file) {
    const rows = ok(await supabase.from('attachments').delete().eq('id', file.id).select('id'));
    if (!rows.length) throw new Error('Sem permissão para esta ação');
    await supabase.storage.from(BUCKET).remove([file.path]);
  },
  async attachmentUrl(file, opts) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.path, 300, opts?.download ? { download: file.name } : undefined);
    if (error || !data) throw new Error('Não foi possível abrir o ficheiro');
    return data.signedUrl;
  },

  async createLot(orgId, lot) {
    return ok(await supabase.rpc('create_lot', { p_org: orgId, ...lotPayload(lot) }));
  },
  async updateLot(lotId, lot) {
    ok(await supabase.rpc('update_lot', { p_lot: lotId, ...lotPayload(lot) }));
  },
  async advanceLot(lotId) {
    ok(await supabase.rpc('advance_lot', { p_lot: lotId }));
  },

  async createProduct(orgId, p) {
    return ok(
      await supabase.rpc('create_product', {
        p_org: orgId,
        p_name: p.name,
        p_sku: p.sku,
        // p_type has no SQL default, so it must be sent; generated RPC types don't model null args.
        p_type: p.typeId || (null as unknown as string),
        p_price: p.price,
        p_min_stock: p.minStock,
        p_margin: p.margin,
      }),
    );
  },
  async updateProduct(id, p) {
    ok(
      await supabase
        .from('products')
        .update({
          name: p.name.trim(),
          sku: p.sku.trim() || undefined,
          type_id: p.typeId || null,
          min_stock: p.minStock,
          margin: p.margin,
        })
        .eq('id', id),
    );
  },
  async setPrice(id, price) {
    ok(await supabase.rpc('set_price', { p_product: id, p_price: price }));
  },
  async removeProduct(id) {
    const rows = ok(await supabase.from('products').delete().eq('id', id).select('id'));
    if (!rows.length) throw new Error('Sem permissão para esta ação');
  },

  async addType(orgId, name) {
    ok(await supabase.from('product_types').insert({ org_id: orgId, name: name.trim() }));
  },
  async removeType(id) {
    ok(await supabase.from('product_types').delete().eq('id', id));
  },
  async addCategory(orgId, name, color) {
    return ok(await supabase.from('expense_categories').insert({ org_id: orgId, name: name.trim(), color }).select('id').single())
      .id;
  },
  async removeCategory(id) {
    ok(await supabase.from('expense_categories').delete().eq('id', id));
  },

  async inviteMember(orgId, email, role: Role) {
    ok(await supabase.rpc('invite_member', { p_org: orgId, p_email: email, p_role: role }));
  },
  async cancelInvite(id) {
    ok(await supabase.from('invites').delete().eq('id', id));
  },
  async approveJoin(id) {
    ok(await supabase.rpc('approve_join_request', { p_request: id }));
  },
  async denyJoin(id) {
    ok(await supabase.from('join_requests').delete().eq('id', id));
  },
  async setMemberRole(orgId, userId, role) {
    ok(await supabase.from('memberships').update({ role }).eq('org_id', orgId).eq('user_id', userId));
  },
  async removeMember(orgId, userId) {
    ok(await supabase.from('memberships').delete().eq('org_id', orgId).eq('user_id', userId));
  },
};
