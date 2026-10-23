import { AttachmentRow, DropButton } from '../../components/ui/Attachments';
import { useFilePicker } from '../../components/ui/useFilePicker';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, Dot, KeyValues, ProgressBar } from '../../components/ui/Display';
import { Icon } from '../../components/ui/Icon';
import { COLORS, LOT_NEXT, LOT_STATUS, NO_CATEGORY } from '../../domain/constants';
import { dateTimeLabel, dayLabelYear, fmt, initials, sfmt } from '../../domain/format';
import type { AttachTarget } from '../../api/types';
import type { Attachment } from '../../domain/types';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { useUi } from '../../store/uiStore';

function Missing() {
  return <p className="m-0 text-sm text-muted">Este registo já não existe.</p>;
}

// ── Lot ──────────────────────────────────────────────────────────────────

export function LotDetail({ lotId }: { lotId: string }) {
  const { db, derived } = useOrgData();
  const { run } = useAction();
  const openModal = useUi((s) => s.openModal);
  const L = derived.lotById[lotId];
  if (!L) return <Missing />;
  const cur = db.settings.currency;
  const st = LOT_STATUS[L.status];
  const p = derived.productById[L.productId];
  const avg = L.sold ? L.rev / L.sold : 0;
  const next = LOT_NEXT[L.status];

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
    </>
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

function PersonValue({ name }: { name: string }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <Avatar initials={initials(name)} size={24} />
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
          { label: 'Vendido por', value: <PersonValue name={who} /> },
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
  const admin = (db.members.find((m) => m.role === 'Admin') ?? db.members[0])?.name ?? '—';
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
          { label: 'Criado por', value: <PersonValue name={createdBy} /> },
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
