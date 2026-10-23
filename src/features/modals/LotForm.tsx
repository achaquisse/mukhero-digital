import { Controller, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { PATHS } from '../../app/paths';
import { MetricStrip } from '../../components/ui/Display';
import { NumberField, TextField } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { COLORS } from '../../domain/constants';
import { fmt } from '../../domain/format';
import * as M from '../../domain/mutations';
import { lotSchema } from '../../domain/schemas';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { useFilters } from '../../store/filtersStore';
import { useUi } from '../../store/uiStore';
import { ProductPicker, SubmitButton } from './formKit';
import { useZodForm } from './useZodForm';

const STATUS_OPTS = [
  ['encomendado', 'Encomendado'],
  ['transito', 'Em trânsito'],
  ['recebido', 'Recebido'],
] as const;

const str = (n: number) => (n ? String(n) : '');
const num = (s: string) => Number(String(s).replace(',', '.')) || 0;

export function LotForm({ productId, editId }: { productId?: string; editId?: string }) {
  const { org, db, derived } = useOrgData();
  const { run } = useAction();
  const openModal = useUi((s) => s.openModal);
  const close = useUi((s) => s.closeModal);
  const setStockView = useFilters((s) => s.setStockView);
  const navigate = useNavigate();
  const cur = db.settings.currency;
  const editing = editId ? db.lots.find((l) => l.id === editId) : undefined;
  const init = editing ? M.lotToInput(editing, db.settings.fx) : null;
  const firstGood = derived.products.find((p) => !p.service);

  const { register, control, handleSubmit, formState } = useZodForm(lotSchema, {
    defaultValues: init
      ? {
          productId: init.productId,
          qty: str(init.qty),
          usd: str(init.usd),
          fx: str(init.fx),
          freight: str(init.freight),
          customs: str(init.customs),
          other: str(init.other),
          supplier: init.supplier,
          status: init.status,
        }
      : {
          productId: productId ?? firstGood?.id ?? '',
          qty: '50',
          usd: '',
          fx: String(db.settings.fx),
          freight: '',
          customs: '',
          other: '',
          supplier: '',
          status: 'encomendado',
        },
  });
  const errors = formState.errors;
  const [productIdV, qtyV, usdV, fxV, freightV, customsV, otherV] = useWatch({
    control,
    name: ['productId', 'qty', 'usd', 'fx', 'freight', 'customs', 'other'],
  });
  const { total, unit } = M.lotTotals({
    qty: num(qtyV),
    usd: num(usdV),
    fx: num(fxV),
    freight: num(freightV),
    customs: num(customsV),
    other: num(otherV),
  });
  const p = derived.productById[productIdV];
  const margin = p?.margin ?? db.settings.margin;
  const last = p ? derived.lastLot[p.id] : undefined;
  const hint = !p ? '' : last ? `Último lote ${last.code} · ${fmt(last.unit)} ${cur} / un.` : 'Primeiro lote deste produto';

  const onSubmit = handleSubmit(async (val) => {
    if (editId) {
      if ((await run((api) => api.updateLot(editId, val), 'Lote actualizado')).ok) openModal({ kind: 'lotDetail', lotId: editId });
      return;
    }
    if ((await run((api) => api.createLot(org.id, val), 'Lote criado')).ok) {
      close();
      setStockView('lotes');
      navigate(PATHS.stock);
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Controller
        control={control}
        name="productId"
        render={({ field }) => (
          <ProductPicker mode="lot" value={field.value} onChange={field.onChange} error={errors.productId?.message} hint={hint} />
        )}
      />
      <div className="grid grid-cols-3 gap-2.5">
        <NumberField small decimal={false} label="Quantidade" {...register('qty')} error={errors.qty?.message} />
        <NumberField small label="Preço un. (USD)" {...register('usd')} error={errors.usd?.message} />
        <NumberField small label="Câmbio" {...register('fx')} error={errors.fx?.message} />
        <NumberField small label="Frete" {...register('freight')} error={errors.freight?.message} />
        <NumberField small label="Alfândega" {...register('customs')} error={errors.customs?.message} />
        <NumberField small label="Outros" {...register('other')} error={errors.other?.message} />
      </div>
      <TextField
        small
        label="Fornecedor"
        placeholder="Ex.: Shenzhen SecureTech"
        {...register('supplier')}
        error={errors.supplier?.message}
      />
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <Segmented
            label="Estado do lote"
            stretch
            options={STATUS_OPTS}
            value={field.value}
            onChange={field.onChange}
            className="[&>button]:py-[7px]"
          />
        )}
      />
      <MetricStrip
        tone="white"
        items={[
          { label: 'Custo total', value: `${fmt(total)} ${cur}` },
          { label: 'Custo / un.', value: `${fmt(unit)} ${cur}` },
          { label: `Preço sugerido · margem ${margin}%`, value: `${fmt(unit * (1 + margin / 100))} ${cur}`, color: COLORS.green },
        ]}
      />
      <SubmitButton>{editId ? 'Guardar alterações' : 'Criar lote'}</SubmitButton>
    </form>
  );
}
