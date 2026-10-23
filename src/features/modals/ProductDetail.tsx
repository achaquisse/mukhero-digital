import { useMemo, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { Badge, ProgressBar } from '../../components/ui/Display';
import { FieldError, NumberField, TextField } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { ChipGroup } from '../../components/ui/Segmented';
import { COLORS, LOT_STATUS } from '../../domain/constants';
import { sum, type ProductView } from '../../domain/derive';
import { addMonths, dayLabelYear, fmt, monthShort, sfmt, todayISO } from '../../domain/format';
import { makeProductEditSchema } from '../../domain/schemas';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { useEntrance } from '../../hooks/useEntrance';
import { toast, useUi } from '../../store/uiStore';
import { useZodForm } from './useZodForm';
import { skuTakenIn } from '../../domain/mutations';

export function ProductDetail({ productId }: { productId: string }) {
  const { db, derived } = useOrgData();
  const { run } = useAction();
  const ask = useUi((s) => s.ask);
  const openModal = useUi((s) => s.openModal);
  const close = useUi((s) => s.closeModal);
  const [editing, setEditing] = useState(false);
  const e = useEntrance(productId);
  const p = derived.productById[productId];
  if (!p) return <p className="m-0 text-sm text-muted">Este produto já não existe.</p>;

  const cur = db.settings.currency;
  const sales = db.sales.filter((s) => s.productId === p.id);
  const rev = sum(sales, (s) => s.qty * s.price);
  const realized = rev - sum(sales, derived.cogs);
  const units = sum(sales, (s) => s.qty);
  const marginColor = p.marginP >= 25 ? COLORS.green : p.marginP >= 0 ? COLORS.amber : COLORS.red;
  const lots = derived.lots.filter((L) => L.productId === p.id).toSorted((a, b) => b.orderDate.localeCompare(a.orderDate));
  const defMargin = p.margin ?? db.settings.margin;

  const months = Array.from({ length: 6 }, (_, i) => addMonths(todayISO().slice(0, 7), i - 5));
  const perMonth: Record<string, number> = {};
  for (const s of sales) perMonth[s.date.slice(0, 7)] = (perMonth[s.date.slice(0, 7)] ?? 0) + s.qty;
  const max6 = Math.max(1, ...months.map((k) => perMonth[k] ?? 0));

  const stats: Array<[string, string, string, string]> = [
    p.service
      ? ['Tipo', 'Serviço', COLORS.ink, 'sem stock']
      : [
          'Em stock',
          String(p.onHand),
          p.onHand <= p.minStock ? COLORS.red : COLORS.ink,
          `mínimo ${p.minStock}${p.transit ? ` · +${p.transit} a caminho` : ''}`,
        ],
    ['Valor do stock', `${fmt(p.onHand * p.price)} ${cur}`, COLORS.ink, `a custo ${fmt(p.stockCost)}`],
    [
      'Lucro bruto / un.',
      p.hasCost ? `${sfmt(p.gpU)} ${cur}` : '—',
      marginColor,
      `margem actual ${p.hasCost ? `${Math.round(p.marginP)}%` : '—'} · padrão ${defMargin}%`,
    ],
    ['Unidades vendidas', fmt(units), COLORS.ink, `${p.u90} nos últimos 90 dias`],
    ['Receita total', `${fmt(rev)} ${cur}`, COLORS.ink, `preço médio ${fmt(units ? rev / units : 0)}`],
    [
      'Lucro bruto realizado',
      `${sfmt(realized)} ${cur}`,
      realized >= 0 ? COLORS.green : COLORS.red,
      `margem ${rev ? Math.round((realized / rev) * 100) : 0}%`,
    ],
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon name={p.icon || 'category'} size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">{p.name}</span>
          <span className="text-xs text-muted">
            {[p.sku, p.typeName, p.service ? 'Serviço' : null].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[22px] font-semibold tracking-[-0.03em]">{fmt(p.price)}</span>
          <span className="text-[11px] text-muted">{cur} · preço actual</span>
        </div>
      </div>

      {editing ? (
        <ProductEditForm p={p} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button icon="edit" onClick={() => setEditing(true)}>
            Editar produto
          </Button>
          <Button icon="point_of_sale" onClick={() => openModal({ kind: 'sale', productId: p.id })}>
            Nova venda
          </Button>
          {!p.service && (
            <Button icon="local_shipping" onClick={() => openModal({ kind: 'lot', productId: p.id })}>
              Novo lote
            </Button>
          )}
        </div>
      )}

      <div className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-xl bg-[#ECEBF5]">
        {stats.map(([label, value, color, sub]) => (
          <div key={label} className="flex min-w-0 flex-col gap-[3px] bg-surface p-3">
            <span className="text-[11px] text-muted">{label}</span>
            <span className="truncate text-base font-semibold tracking-[-0.02em]" style={{ color }}>
              {value}
            </span>
            <span className="text-[11px] text-muted">{sub}</span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-muted">Vendas · últimos 6 meses</span>
          <span className="text-xs text-muted">{fmt(sum(months, (k) => perMonth[k] ?? 0))} unidades</span>
        </div>
        <div
          className="flex flex-col gap-1.5 rounded-xl bg-surface px-3 pb-2 pt-3"
          role="img"
          aria-label="Unidades vendidas por mês"
        >
          <div className="flex h-[84px] items-end gap-2.5">
            {months.map((k) => (
              <div key={k} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[3px]">
                <span className="text-[10px] font-semibold text-ink">{perMonth[k] ? perMonth[k] : ''}</span>
                <div
                  className="min-h-0.5 w-full max-w-[30px] rounded-t-[4px] bg-[linear-gradient(180deg,#9B8CFF,#5B4CF5)] transition-[height] duration-400"
                  style={{ height: `${((perMonth[k] ?? 0) / max6) * 100 * e}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5" aria-hidden>
            {months.map((k) => (
              <div key={k} className="flex-1 text-center text-[10px] text-muted">
                {monthShort(k)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!p.service && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Stock por lote</span>
          <div className="flex flex-col gap-1.5">
            {lots.map((L) => {
              const st = LOT_STATUS[L.status];
              return (
                <button
                  key={L.id}
                  type="button"
                  onClick={() => openModal({ kind: 'lotDetail', lotId: L.id })}
                  className="flex flex-col gap-2 rounded-xl border border-divider bg-white px-3 py-2.5 text-left text-ink hover:border-[#E1DEFF] hover:bg-[#FAFAFF]"
                >
                  <div className="flex w-full items-center gap-2.5">
                    <span className="text-sm font-semibold">{L.code}</span>
                    <Badge bg={st.bg} color={st.color} className="px-2! py-0.5! text-[11px]!">
                      {st.label}
                    </Badge>
                    <span className="flex-1" />
                    {L.recv && (
                      <span className="text-[13px] font-semibold" style={{ color: L.profit >= 0 ? COLORS.green : COLORS.red }}>
                        {sfmt(L.profit)} {cur}
                      </span>
                    )}
                    <Icon name="chevron_right" size={17} className="text-subtle" />
                  </div>
                  <div className="w-full">
                    <ProgressBar height={5} value={L.recv && L.qty ? (L.left / L.qty) * 100 : 0} />
                  </div>
                  <div className="flex w-full flex-wrap justify-between gap-2.5 text-xs text-muted">
                    <span>
                      {L.recv ? `${L.left} de ${L.qty} restantes · ${L.sold} vendidos` : `${L.qty} unidades encomendadas`}
                    </span>
                    <span>
                      {fmt(L.unit)} {cur} / un. ·{' '}
                      {L.arrivalDate ? `chegou ${dayLabelYear(L.arrivalDate)}` : `encomendado ${dayLabelYear(L.orderDate)}`}
                    </span>
                  </div>
                </button>
              );
            })}
            {!lots.length && (
              <div className="rounded-xl bg-surface p-3 text-[13px] text-muted">Ainda sem lotes deste produto.</div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Histórico de preços</span>
        <ol className="m-0 flex list-none flex-col rounded-xl bg-surface px-1.5 py-1">
          {p.ph
            .map((x, i, arr) => {
              const prev = arr[i - 1];
              const delta = prev?.price ? ((x.price - prev.price) / prev.price) * 100 : null;
              const isCur = i === arr.length - 1;
              return (
                <li
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-[9px] text-sm"
                  style={{ background: isCur ? '#fff' : 'transparent' }}
                >
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="font-semibold">
                      {fmt(x.price)} {cur}
                    </span>
                    <span className="text-xs text-muted">
                      {x.from ? `desde ${dayLabelYear(x.from.slice(0, 10))}` : 'preço inicial'} · {x.by || '—'}
                    </span>
                  </span>
                  <span
                    className="text-xs font-[550]"
                    style={{ color: delta == null ? COLORS.muted : delta >= 0 ? COLORS.green : COLORS.red }}
                  >
                    {delta == null ? '' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                  </span>
                  <Badge
                    bg={isCur ? '#EFEDFF' : '#F2F4F7'}
                    color={isCur ? COLORS.brand : COLORS.muted}
                    className="px-2! text-[11px]! font-semibold!"
                  >
                    {isCur ? 'Actual' : 'Anterior'}
                  </Badge>
                </li>
              );
            })
            .toReversed()}
        </ol>
      </div>

      <Button
        variant="danger-outline"
        size="block"
        icon="delete"
        onClick={() => {
          if (db.sales.some((s) => s.productId === p.id) || db.lots.some((l) => l.productId === p.id)) {
            toast('Produto com movimentos não pode ser removido');
            return;
          }
          ask({
            title: 'Remover produto?',
            message: `«${p.name}» será removido do catálogo.`,
            confirmLabel: 'Remover produto',
            onConfirm: () => {
              close();
              void run((api) => api.removeProduct(p.id), 'Produto removido');
            },
          });
        }}
      >
        Remover produto
      </Button>
    </>
  );
}

function ProductEditForm({ p, onDone }: { p: ProductView; onDone: () => void }) {
  const { db } = useOrgData();
  const { run } = useAction();
  const cur = db.settings.currency;
  const schema = useMemo(
    () => makeProductEditSchema({ skuTaken: skuTakenIn(db, p.id), currentPrice: p.price }),
    [db, p.id, p.price],
  );
  const { register, control, handleSubmit, formState } = useZodForm(schema, {
    defaultValues: {
      name: p.name,
      sku: p.sku,
      typeId: p.typeId,
      price: String(p.price),
      minStock: String(p.minStock),
      margin: String(p.margin ?? db.settings.margin),
    },
  });
  const errors = formState.errors;
  const np = Number((useWatch({ control, name: 'price' }) ?? '').replace(',', '.')) || 0;
  const priceHint =
    np > 0 && np !== p.price && p.hasCost
      ? `Novo lucro bruto / un.: ${sfmt(np - p.unitCost)} ${cur} · margem ${Math.round(((np - p.unitCost) / np) * 100)}%`
      : 'Alterar o preço cria uma nova entrada no histórico · vendas anteriores mantêm o seu preço.';
  return (
    <form
      noValidate
      aria-label="Editar produto"
      className="flex flex-col gap-3 rounded-xl border border-card-line p-3.5"
      onSubmit={handleSubmit(async ({ price, ...v }) => {
        const priceChanged = price !== p.price;
        const res = await run(
          async (api) => {
            await api.updateProduct(p.id, v);
            if (priceChanged) await api.setPrice(p.id, price);
          },
          priceChanged ? `Produto actualizado · preço ${fmt(price)} ${cur}` : 'Produto actualizado',
        );
        if (res.ok) onDone();
      })}
    >
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2.5">
        <TextField label="Nome" {...register('name')} error={errors.name?.message} />
        <TextField label="Código" {...register('sku')} error={errors.sku?.message} />
      </div>
      <div className="flex flex-col gap-1.5">
        <NumberField label={`Preço de venda (${cur})`} {...register('price')} error={errors.price?.message} />
        <span className="text-xs text-muted">{priceHint}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-muted">Tipo</span>
        <Controller
          control={control}
          name="typeId"
          render={({ field }) => (
            <ChipGroup
              label="Tipo de produto"
              options={db.types.map((t) => ({ id: t.id, label: t.name }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={errors.typeId?.message} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <NumberField label="Margem padrão (%)" {...register('margin')} error={errors.margin?.message} />
        <NumberField label="Stock mínimo" decimal={false} {...register('minStock')} error={errors.minStock?.message} />
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary">
          Guardar
        </Button>
      </div>
    </form>
  );
}
