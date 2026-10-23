import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { DraftFileRow, DropButton } from '../../components/ui/Attachments';
import { useFilePicker } from '../../components/ui/useFilePicker';
import { TextField, FieldError } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { COLORS } from '../../domain/constants';
import { estimateSaleCost } from '../../domain/derive';
import { dayLabelYear, fmt, sfmt, todayISO } from '../../domain/format';
import { makeSaleSchema } from '../../domain/schemas';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { uid } from '../../domain/id';
import { useUi } from '../../store/uiStore';
import { ProductPicker, SubmitButton } from './formKit';
import { uploadAfterSave } from './uploadAfterSave';
import { useZodForm } from './useZodForm';

export function SaleForm({ productId }: { productId?: string }) {
  const { org, db, derived } = useOrgData();
  const { run } = useAction();
  const close = useUi((s) => s.closeModal);
  const cur = db.settings.currency;
  const today = todayISO();

  const schema = useMemo(
    () =>
      makeSaleSchema({
        today,
        available: (pid) => (derived.productById[pid]?.service ? null : derived.avail(pid).total),
        priceOf: (pid) => derived.productById[pid]?.price ?? 0,
      }),
    [derived, today],
  );
  const firstGood = derived.products.find((p) => !p.service) ?? derived.products[0];
  const { register, control, handleSubmit, setValue, getValues, formState } = useZodForm(schema, {
    defaultValues: { productId: productId ?? firstGood?.id ?? '', qty: 1, customer: '', date: today, files: [] },
  });
  const errors = formState.errors;
  const [pid, qty, files] = useWatch({ control, name: ['productId', 'qty', 'files'] });
  const p = derived.productById[pid];
  const av = p && !p.service ? derived.avail(p.id) : null;
  const q = Number.isFinite(qty) ? qty : 0;
  const price = p?.price ?? 0;
  const total = q * price;
  const gp = p ? total - estimateSaleCost(p, av, q) : 0;
  const last = p?.ph[p.ph.length - 1];
  const picker = useFilePicker((add) => setValue('files', [...getValues('files'), ...add.map((file) => ({ id: uid(), file }))]));

  const onSubmit = handleSubmit(async (v) => {
    const r = await run(
      async (api) => {
        const id = await api.recordSale(org.id, v);
        if (v.files.length) await uploadAfterSave(api, org.id, { kind: 'sale', id }, v.files);
        return id;
      },
      `Venda de ${fmt(v.qty * price)} ${cur} registada`,
    );
    if (r.ok) close();
  });

  const avail = !p
    ? ''
    : p.service
      ? 'Serviço · sem stock'
      : `${av!.total} disponíveis${av!.lots[0] ? ` · sai de ${av!.lots[0].code}` : ''}`;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Controller
        control={control}
        name="productId"
        render={({ field }) => (
          <ProductPicker
            mode="sale"
            value={field.value}
            onChange={(id) => {
              field.onChange(id);
              setValue('qty', 1, { shouldValidate: formState.isSubmitted });
            }}
            error={errors.productId?.message}
            hint={avail}
          />
        )}
      />

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sale-qty" className="text-[13px] font-medium text-muted">
            Quantidade
          </label>
          <div className={`flex items-center rounded-[10px] border ${errors.qty ? 'border-[#F04438]' : 'border-line'}`}>
            <button
              type="button"
              aria-label="Diminuir quantidade"
              onClick={() => setValue('qty', Math.max(1, q - 1), { shouldValidate: true })}
              className="h-[42px] w-10 border-0 bg-transparent text-ink"
            >
              <Icon name="remove" size={18} />
            </button>
            <input
              id="sale-qty"
              inputMode="numeric"
              aria-invalid={!!errors.qty}
              {...register('qty', { valueAsNumber: true })}
              className="w-10 border-0 bg-transparent text-center text-[15px] font-semibold text-ink outline-none"
            />
            <button
              type="button"
              aria-label="Aumentar quantidade"
              onClick={() => setValue('qty', q + 1, { shouldValidate: true })}
              className="h-[42px] w-10 border-0 bg-transparent text-ink"
            >
              <Icon name="add" size={18} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Preço unitário ({cur})</span>
          <div
            className="flex h-11 items-center gap-2 rounded-[10px] border border-[#ECEBF5] bg-surface px-3"
            aria-label={`Preço unitário ${fmt(price)} ${cur}, definido no produto`}
          >
            <span className="flex-1 text-[15px] font-semibold text-ink">{fmt(price)}</span>
            {last?.from && (
              <span className="whitespace-nowrap text-[11px] text-muted">desde {dayLabelYear(last.from.slice(0, 10))}</span>
            )}
            <Icon name="lock" size={16} className="text-subtle" />
          </div>
        </div>
      </div>
      <FieldError message={errors.qty?.message} />

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Cliente" placeholder="Opcional" {...register('customer')} error={errors.customer?.message} />
        <TextField label="Data" type="date" max={today} {...register('date')} error={errors.date?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-muted">Anexos</span>
        {files.map((d) => (
          <DraftFileRow
            key={d.id}
            draft={d}
            onRemove={() =>
              setValue(
                'files',
                getValues('files').filter((f) => f.id !== d.id),
              )
            }
          />
        ))}
        {picker.input}
        <DropButton label="Anexar fatura, recibo ou comprovativo" onClick={picker.open} />
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-xl bg-[#ECEBF5]" aria-live="polite">
        <Summary label="Total">
          {fmt(total)} <span className="text-[11px] font-normal text-muted">{cur}</span>
        </Summary>
        <Summary label="Lucro bruto" color={gp >= 0 ? COLORS.green : COLORS.red}>
          {sfmt(gp)}
        </Summary>
        <Summary label="Margem bruta" color={gp >= 0 ? COLORS.green : COLORS.red}>
          {total ? `${Math.round((gp / total) * 100)}%` : '—'}
        </Summary>
      </div>

      <SubmitButton>Registar venda</SubmitButton>
    </form>
  );
}

function Summary({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px] bg-surface p-3">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-lg font-semibold tracking-[-0.02em]" style={color ? { color } : undefined}>
        {children}
      </span>
    </div>
  );
}
