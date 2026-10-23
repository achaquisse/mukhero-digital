import { useState } from 'react';
import { AttachmentRow, DropButton } from '../../components/ui/Attachments';
import { useFilePicker } from '../../components/ui/useFilePicker';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, Dot, KeyValues, ProgressBar } from '../../components/ui/Display';
import { NumberField } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { COLORS, LOT_NEXT, LOT_STATUS, NO_CATEGORY } from '../../domain/constants';
import { sum, type LotView } from '../../domain/derive';
import { addDays, dateTimeLabel, dayLabel, dayLabelYear, fmt, initials, plural, sfmt, todayISO } from '../../domain/format';
import { minLotQty } from '../../domain/mutations';
import type { AttachTarget } from '../../api/types';
import type { Attachment, Sale } from '../../domain/types';
import { useEntrance } from '../../hooks/useEntrance';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { useUi } from '../../store/uiStore';

function Missing() {
  return <p className="m-0 text-sm text-muted">Este registo já não existe.</p>;
}

// ── Lot ──────────────────────────────────────────────────────────────────

export function LotDetail({ lotId }: { lotId: string }) {
  const { db, derived, org } = useOrgData();
  const { run } = useAction();
  const openModal = useUi((s) => s.openModal);
  const L = derived.lotById[lotId];
  if (!L) return <Missing />;
  const cur = db.settings.currency;
  const st = LOT_STATUS[L.status];
  const p = derived.productById[L.productId];
  const avg = L.sold ? L.rev / L.sold : 0;
  const next = LOT_NEXT[L.status];
  const sales = db.sales.filter((s) => s.lotId === L.id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge bg={st.bg} color={st.color}>
          {st.label}
        </Badge>
        <span className="text-[13px] text-muted">
          {p?.name ?? 'Produto removido'} · {L.supplier}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[13px]">
          <span>
            {L.recv ? `${L.sold} de ${L.qty} vendidos${L.lost ? ` · ${L.lost} perdidos` : ''}` : `${L.qty} unidades encomendadas`}
          </span>
          <span className="text-muted">
            {L.arrivalDate ? `chegou ${dayLabelYear(L.arrivalDate)}` : `encomendado ${dayLabelYear(L.orderDate)}`}
          </span>
        </div>
        <ProgressBar
          value={L.recv && L.qty ? (L.sold / L.qty) * 100 : 0}
          extra={{ value: L.qty ? (L.lost / L.qty) * 100 : 0, color: '#F04438' }}
        />
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-xl border border-divider bg-divider">
        {(
          [
            ['Custo total', `${fmt(L.cost)} ${cur}`, COLORS.ink],
            ['Custo / un.', `${fmt(L.unit)} ${cur}`, COLORS.ink],
            ['Restantes', String(L.left), COLORS.ink],
            ['Receita', `${fmt(L.rev)} ${cur}`, COLORS.ink],
            ['Preço médio', `${fmt(avg)} ${cur}`, COLORS.ink],
            ['Lucro', L.recv ? `${sfmt(L.profit)} ${cur}` : '—', L.profit >= 0 ? COLORS.green : COLORS.red],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="flex flex-col gap-[3px] bg-white p-3">
            <div className="text-[11px] text-muted">{label}</div>
            <div className="text-[15px] font-semibold" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-divider">
        <div className="border-b border-divider bg-[#FAFBFC] px-3 py-[9px] text-xs font-[550] text-muted">
          Custos de importação
        </div>
        {L.costs.length ? (
          L.costs.map((c, i) => (
            <div key={i} className="flex justify-between border-b border-[#F1F2F5] px-3 py-[9px] text-sm last:border-b-0">
              <span>{c.label}</span>
              <span>
                {fmt(c.value)} {cur}
              </span>
            </div>
          ))
        ) : (
          <div className="flex justify-between px-3 py-[9px] text-sm">
            <span>Sem custos registados</span>
            <span>—</span>
          </div>
        )}
      </div>
      {next && (
        <Button
          variant="primary"
          size="block"
          icon={next.icon}
          className="py-3!"
          onClick={() => void run((api) => api.advanceLot(L.id), `${L.code} · ${LOT_STATUS[next.to].label}`)}
        >
          {next.label}
        </Button>
      )}
      {(L.status === 'encomendado' || L.status === 'transito') && (
        <Button size="block" icon="edit" className="font-[550]" onClick={() => openModal({ kind: 'lot', editId: L.id })}>
          Editar lote
        </Button>
      )}
      <LotSalesChart lot={L} sales={sales} />
      <LotSalesList sales={sales} cur={cur} />
      {org.role === 'Admin' && <LotQtyEditor lot={L} cur={cur} />}
    </>
  );
}

const DAY_MS = 864e5;
const dayIndex = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

function LotSalesChart({ lot: L, sales }: { lot: LotView; sales: Sale[] }) {
  const e = useEntrance(L.id);
  if (!sales.length) return null;
  const perDay = new Map<string, number>();
  for (const s of sales) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.qty);
  const days = [...perDay.keys()].toSorted();
  const firstSale = days[0]!;
  const lastSale = days.at(-1)!;
  const arrival = L.arrivalDate ?? L.orderDate;
  const start = arrival < firstSale ? arrival : firstSale;
  const today = todayISO();
  let end = L.left > 0 && today > lastSale ? today : lastSale;
  if (end <= start) end = addDays(start, 1);
  const span = dayIndex(start, end);
  const total = sum(sales, (s) => s.qty);
  const top = Math.max(L.qty, total, 1);
  const maxDay = Math.max(...perDay.values());
  const x = (d: string) => (dayIndex(start, d) / span) * 100;
  const y = (n: number) => 100 - (n / top) * 100 * e;

  let acc = 0;
  let line = `M0,${y(0)}`;
  for (const d of days) {
    line += ` H${x(d)}`;
    acc += perDay.get(d)!;
    line += ` V${y(acc)}`;
  }
  line += ' H100';
  const mid = addDays(start, Math.round(span / 2));
  const qtyY = (1 - L.qty / top) * 100;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-muted">Vendas ao longo do tempo</span>
        <span className="text-xs text-muted">
          {fmt(total)} de {fmt(L.qty)} unidades
        </span>
      </div>
      <div
        className="flex flex-col gap-1.5 rounded-xl bg-surface px-3 pb-2 pt-3"
        role="img"
        aria-label={`Unidades vendidas acumuladas de ${dayLabelYear(start)} a ${dayLabelYear(end)}: ${total} de ${L.qty}`}
      >
        <div className="flex gap-2">
          <div className="flex h-[120px] flex-col justify-between text-right text-[10px] text-muted" aria-hidden>
            <span>{fmt(top)}</span>
            <span>0</span>
          </div>
          <div className="relative h-[120px] min-w-0 flex-1">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <defs>
                <linearGradient id={`lot-area-${L.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B4CF5" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#5B4CF5" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="0" x2="100" y1="100" y2="100" stroke="#E4E2F0" vectorEffect="non-scaling-stroke" />
              <line
                x1="0"
                x2="100"
                y1={qtyY}
                y2={qtyY}
                stroke="#98A2B3"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              {days.map((d) => {
                const h = (perDay.get(d)! / maxDay) * 30 * e;
                return <rect key={d} x={Math.min(x(d), 99.2)} width={0.8} y={100 - h} height={h} fill="#9B8CFF" opacity={0.55} />;
              })}
              <path d={`${line} V100 H0 Z`} fill={`url(#lot-area-${L.id})`} />
              <path
                d={line}
                fill="none"
                stroke="#5B4CF5"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span
              className="absolute right-0 -translate-y-full pb-0.5 text-[10px] text-muted"
              style={{ top: `${qtyY}%` }}
              aria-hidden
            >
              Qtd {L.qty}
            </span>
          </div>
        </div>
        <div className="flex justify-between pl-6 text-[10px] text-muted" aria-hidden>
          <span>{dayLabel(start)}</span>
          {span >= 4 && <span>{dayLabel(mid)}</span>}
          <span>{dayLabel(end)}</span>
        </div>
        <div className="flex gap-3 text-[10px] text-muted" aria-hidden>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded bg-brand" /> Acumulado
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-1 rounded-sm bg-[#9B8CFF] opacity-60" /> Por dia
          </span>
        </div>
      </div>
    </div>
  );
}

const SALES_PREVIEW = 6;

function LotSalesList({ sales, cur }: { sales: Sale[]; cur: string }) {
  const openModal = useUi((s) => s.openModal);
  const [all, setAll] = useState(false);
  const sorted = sales.toSorted((a, b) => b.date.localeCompare(a.date) || (b.soldAt ?? '').localeCompare(a.soldAt ?? ''));
  const shown = all ? sorted : sorted.slice(0, SALES_PREVIEW);
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-muted">Vendas deste lote</span>
        <span className="text-xs text-muted">{plural(sales.length, 'venda', 'vendas')}</span>
      </div>
      {sales.length ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-divider">
          {shown.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openModal({ kind: 'saleDetail', saleId: s.id })}
              className="flex items-center gap-3 border-b border-[#F1F2F5] bg-white px-3 py-[9px] text-left text-sm text-ink last:border-b-0 hover:bg-[#FAFAFF]"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate font-[550]">{s.customer || 'Cliente não indicado'}</span>
                <span className="text-xs text-muted">
                  {dayLabelYear(s.date)}
                  {s.soldBy ? ` · ${s.soldBy}` : ''}
                </span>
              </span>
              <span className="flex flex-col items-end gap-px">
                <span className="font-semibold">
                  {fmt(s.qty * s.price)} {cur}
                </span>
                <span className="text-xs text-muted">
                  {s.qty} × {fmt(s.price)}
                </span>
              </span>
              <Icon name="chevron_right" size={17} className="text-subtle" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-surface p-3 text-[13px] text-muted">Ainda sem vendas deste lote.</div>
      )}
      {sorted.length > SALES_PREVIEW && (
        <Button variant="link" className="self-start" onClick={() => setAll((v) => !v)}>
          {all ? 'Mostrar menos' : `Ver todas (${sorted.length})`}
        </Button>
      )}
    </div>
  );
}

function LotQtyEditor({ lot: L, cur }: { lot: LotView; cur: string }) {
  const { db } = useOrgData();
  const { run } = useAction();
  const ask = useUi((s) => s.ask);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(L.qty));
  const [error, setError] = useState<string>();
  const min = minLotQty(db, L.id);

  if (!editing)
    return (
      <Button
        variant="danger-outline"
        size="block"
        icon="edit_note"
        onClick={() => {
          setValue(String(L.qty));
          setError(undefined);
          setEditing(true);
        }}
      >
        Alterar quantidade
      </Button>
    );

  return (
    <form
      noValidate
      aria-label="Alterar quantidade do lote"
      className="flex shrink-0 flex-col gap-3 rounded-xl border border-danger-line bg-danger-soft/40 p-3.5"
      onSubmit={(ev) => {
        ev.preventDefault();
        const n = Number(value.trim());
        if (!Number.isInteger(n) || n < 1) return setError('Indique um número inteiro maior que zero');
        if (n < min) return setError(`Não pode ser inferior a ${min} (vendidos e perdidos)`);
        if (n === L.qty) return setError('A quantidade é igual à actual');
        setError(undefined);
        const newUnit = L.cost / n;
        ask({
          title: 'Alterar quantidade do lote?',
          message:
            `A quantidade de ${L.code} passa de ${L.qty} para ${n} unidades. ` +
            `O custo total mantém-se (${fmt(L.cost)} ${cur}), por isso o custo por unidade passa de ${fmt(L.unit)} para ${fmt(newUnit)} ${cur}. ` +
            'Isto altera o stock disponível e recalcula o custo e o lucro de todas as vendas já feitas deste lote. Use apenas para corrigir erros de contagem.',
          confirmLabel: 'Alterar quantidade',
          onConfirm: async () => {
            const res = await run((api) => api.setLotQty(L.id, n), `${L.code} · quantidade ${n}`);
            if (res.ok) setEditing(false);
          },
        });
      }}
    >
      <div className="flex items-start gap-2 text-[13px] text-danger">
        <Icon name="warning" size={18} />
        <span>Ação sensível · apenas administradores. Afecta stock, custos e lucro deste lote.</span>
      </div>
      <NumberField
        label="Nova quantidade"
        decimal={false}
        value={value}
        onChange={(ev) => setValue(ev.target.value)}
        error={error}
        hint={`Actual ${L.qty} · mínimo ${min} (${L.sold} vendidos${L.lost ? `, ${L.lost} perdidos` : ''})`}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button onClick={() => setEditing(false)}>Cancelar</Button>
        <Button type="submit" variant="danger">
          Guardar
        </Button>
      </div>
    </form>
  );
}

// ── Attachments section shared by sale & expense details ────────────────

function AttachmentsSection({
  files,
  fallbackDate,
  target,
  emptyLabel,
  emptyIcon,
  noun,
}: {
  files: Attachment[];
  fallbackDate: string;
  target: AttachTarget;
  emptyLabel: string;
  emptyIcon: string;
  noun: string;
}) {
  const { run } = useAction();
  const orgId = useOrgData().org.id;
  const ask = useUi((s) => s.ask);
  const picker = useFilePicker(
    (add) =>
      void run(
        (api) => api.uploadAttachments(orgId, target, add),
        add.length > 1 ? `${add.length} anexos adicionados` : 'Anexo adicionado',
      ),
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">Anexos</span>
        <Button variant="link" icon="attach_file" onClick={picker.open}>
          Adicionar
        </Button>
      </div>
      {picker.input}
      {files.map((a) => (
        <AttachmentRow
          key={a.id}
          file={a}
          fallbackDate={fallbackDate}
          onRemove={() =>
            ask({
              title: 'Remover anexo?',
              message: `«${a.name}» será removido desta ${noun}.`,
              confirmLabel: 'Remover',
              onConfirm: () => void run((api) => api.removeAttachment(a), 'Anexo removido'),
            })
          }
        />
      ))}
      {!files.length && <DropButton label={emptyLabel} icon={emptyIcon} onClick={picker.open} />}
    </div>
  );
}

function PersonValue({ name, userId }: { name: string; userId?: string }) {
  const { db } = useOrgData();
  const avatarUrl = db.members.find((m) => (userId ? m.userId === userId : m.name === name))?.avatarUrl;
  return (
    <span className="flex items-center justify-end gap-2">
      <Avatar initials={initials(name)} src={avatarUrl} size={24} />
      {name}
    </span>
  );
}

// ── Sale ─────────────────────────────────────────────────────────────────

export function SaleDetail({ saleId }: { saleId: string }) {
  const { db, derived } = useOrgData();
  const { run } = useAction();
  const ask = useUi((s) => s.ask);
  const close = useUi((s) => s.closeModal);
  const s = db.sales.find((x) => x.id === saleId);
  if (!s) return <Missing />;
  const cur = db.settings.currency;
  const p = derived.productById[s.productId];
  const L = s.lotId ? derived.lotById[s.lotId] : undefined;
  const total = s.qty * s.price;
  const cogs = derived.cogs(s);
  const gp = total - cogs;
  const who = s.soldBy ?? db.members[0]?.name ?? '—';
  const at = s.soldAt ? new Date(s.soldAt) : new Date(`${s.date}T10:00:00`);
  const gpColor = gp >= 0 ? COLORS.green : COLORS.red;
  const name = p?.name ?? 'Produto removido';

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon name={p?.icon || 'category'} size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">{name}</span>
          <span className="text-xs text-muted">{[p?.sku, p?.typeName].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-semibold tracking-[-0.03em]">{fmt(total)}</span>
          <span className="text-xs text-muted">{cur}</span>
        </div>
      </div>
      <KeyValues
        rows={[
          { label: 'Quantidade', value: String(s.qty) },
          { label: 'Preço unitário', value: `${fmt(s.price)} ${cur}` },
          { label: 'Lote', value: L?.code ?? '—' },
          { label: 'Cliente', value: s.customer || '—' },
          { label: 'Data da venda', value: dayLabelYear(s.date) },
        ]}
      />
      <KeyValues
        rows={[
          { label: 'Custo da mercadoria', value: L ? `${fmt(cogs)} ${cur}` : '—' },
          { label: 'Lucro bruto', value: `${sfmt(gp)} ${cur}`, color: gpColor },
          { label: 'Margem bruta', value: total ? `${Math.round((gp / total) * 100)}%` : '—', color: gpColor },
        ]}
      />
      <KeyValues
        rows={[
          { label: 'Vendido por', value: <PersonValue name={who} userId={s.soldBy ? s.soldById : db.members[0]?.userId} /> },
          { label: 'Vendido em', value: dateTimeLabel(at) },
        ]}
      />
      <AttachmentsSection
        files={s.files ?? []}
        fallbackDate={s.date}
        target={{ kind: 'sale', id: s.id }}
        emptyLabel="Anexar fatura ou recibo"
        emptyIcon="attach_file"
        noun="venda"
      />
      <Button
        variant="danger-outline"
        size="block"
        icon="delete"
        onClick={() =>
          ask({
            title: 'Anular venda?',
            message: `A venda de ${fmt(total)} ${cur} (${name}) será eliminada e as unidades voltam ao stock. Esta ação não pode ser desfeita.`,
            confirmLabel: 'Anular venda',
            onConfirm: () => {
              close();
              void run((api) => api.voidSale(s.id), 'Venda anulada');
            },
          })
        }
      >
        Anular venda
      </Button>
    </>
  );
}

// ── Expense ──────────────────────────────────────────────────────────────

export function ExpenseDetail({ expId }: { expId: string }) {
  const { db } = useOrgData();
  const { run } = useAction();
  const ask = useUi((s) => s.ask);
  const close = useUi((s) => s.closeModal);
  const x = db.expenses.find((e) => e.id === expId);
  if (!x) return <Missing />;
  const cur = db.settings.currency;
  const c = db.cats.find((k) => k.id === x.catId) ?? NO_CATEGORY;
  const adminMember = db.members.find((m) => m.role === 'Admin') ?? db.members[0];
  const admin = adminMember?.name ?? '—';
  const createdBy = x.createdBy ?? admin;
  const createdAt = x.createdAt ? new Date(x.createdAt) : new Date(`${x.date}T09:00:00`);

  return (
    <>
      <div className="flex flex-col gap-2 pb-0.5 pt-1">
        <div
          className="inline-flex items-center gap-2 self-start rounded-full px-2.5 py-1 text-[13px] font-[550] text-ink"
          style={{ background: `${c.color}1A` }}
        >
          <Dot color={c.color} />
          {c.name}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[34px] font-semibold tracking-[-0.035em]">{fmt(x.amount)}</span>
          <span className="text-sm text-muted">{cur}</span>
        </div>
      </div>
      <dl className="m-0 flex flex-col rounded-xl bg-surface px-3.5 py-1">
        <div className="flex justify-between gap-3 py-2.5 text-sm">
          <dt className="text-muted">Data da despesa</dt>
          <dd className="m-0 font-medium">{dayLabelYear(x.date)}</dd>
        </div>
        <div className="flex flex-col gap-1 py-2.5 text-sm">
          <dt className="text-muted">Nota</dt>
          <dd className="m-0 whitespace-pre-wrap leading-[1.45]" style={{ color: x.note ? COLORS.ink : COLORS.muted }}>
            {x.note || 'Sem nota'}
          </dd>
        </div>
      </dl>
      <KeyValues
        rows={[
          { label: 'Criado em', value: dateTimeLabel(createdAt) },
          {
            label: 'Criado por',
            value: <PersonValue name={createdBy} userId={x.createdBy ? x.createdById : adminMember?.userId} />,
          },
        ]}
      />
      <AttachmentsSection
        files={x.files ?? []}
        fallbackDate={x.date}
        target={{ kind: 'expense', id: x.id }}
        emptyLabel="Anexar comprovativo da transação"
        emptyIcon="upload_file"
        noun="despesa"
      />
      <Button
        variant="danger-outline"
        size="block"
        icon="delete"
        onClick={() =>
          ask({
            title: 'Eliminar despesa?',
            message: `A despesa de ${fmt(x.amount)} ${cur} (${c.name}) e os seus anexos serão eliminados. Esta ação não pode ser desfeita.`,
            confirmLabel: 'Eliminar despesa',
            onConfirm: () => {
              close();
              void run((api) => api.deleteExpense(x.id), 'Despesa eliminada');
            },
          })
        }
      >
        Eliminar despesa
      </Button>
    </>
  );
}
