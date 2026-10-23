import { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { FieldError, NumberField, TextField } from '../../components/ui/Field';
import { ChipGroup } from '../../components/ui/Segmented';
import * as M from '../../domain/mutations';
import { makeProductSchema } from '../../domain/schemas';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { useUi } from '../../store/uiStore';
import { SubmitButton } from './formKit';
import { useZodForm } from './useZodForm';

export function ProductForm() {
  const { org, db } = useOrgData();
  const { run } = useAction();
  const close = useUi((s) => s.closeModal);
  const cur = db.settings.currency;
  const schema = useMemo(() => makeProductSchema({ skuTaken: M.skuTakenIn(db) }), [db]);
  const { register, control, handleSubmit, formState } = useZodForm(schema, {
    defaultValues: {
      name: '',
      sku: '',
      typeId: db.types[0]?.id ?? '',
      price: '',
      minStock: String(db.settings.minStock),
      margin: String(db.settings.margin),
    },
  });
  const errors = formState.errors;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (v) => {
        if ((await run((api) => api.createProduct(org.id, v), 'Produto adicionado')).ok) close();
      })}
    >
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <TextField label="Nome" placeholder="Ex.: Alarme auto" {...register('name')} error={errors.name?.message} />
        <TextField label="Código" placeholder="ALM-02" {...register('sku')} error={errors.sku?.message} />
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
      <div className="grid grid-cols-3 gap-3">
        <NumberField label={`Preço de venda (${cur})`} {...register('price')} error={errors.price?.message} />
        <NumberField label="Stock mínimo" decimal={false} {...register('minStock')} error={errors.minStock?.message} />
        <NumberField label="Margem padrão (%)" {...register('margin')} error={errors.margin?.message} />
      </div>
      <SubmitButton>Adicionar produto</SubmitButton>
    </form>
  );
}
