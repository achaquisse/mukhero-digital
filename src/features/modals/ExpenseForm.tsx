import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { DraftFileRow, DropButton } from '../../components/ui/Attachments';
import { useFilePicker } from '../../components/ui/useFilePicker';
import { Combobox } from '../../components/ui/Combobox';
import { NumberField, TextAreaField, TextField } from '../../components/ui/Field';
import { MAX_FILE_BYTES, PALETTE } from '../../domain/constants';
import { fileSize, todayISO } from '../../domain/format';
import * as M from '../../domain/mutations';
import { makeExpenseSchema } from '../../domain/schemas';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { uid } from '../../domain/id';
import { toast, useUi } from '../../store/uiStore';
import { SubmitButton } from './formKit';
import { uploadAfterSave } from './uploadAfterSave';
import { useZodForm } from './useZodForm';

export function ExpenseForm() {
  const { org, db } = useOrgData();
  const { run } = useAction();
  const close = useUi((s) => s.closeModal);
  const today = todayISO();
  const cur = db.settings.currency;
  const schema = useMemo(() => makeExpenseSchema(today), [today]);
  const { register, control, handleSubmit, setValue, getValues, formState } = useZodForm(schema, {
    defaultValues: { amount: '', catId: db.cats[0]?.id ?? '', date: today, note: '', files: [] },
  });
  const errors = formState.errors;
  const files = useWatch({ control, name: 'files' });
  const picker = useFilePicker((add) => setValue('files', [...getValues('files'), ...add.map((file) => ({ id: uid(), file }))]));

  const createCategory = async (name: string) => {
    if (M.nameTaken(db.cats, name)) return toast('Já existe uma categoria com este nome');
    const color = PALETTE[db.cats.length % PALETTE.length]!;
    const r = await run((api) => api.addCategory(org.id, name, color), `Categoria «${name}» criada`);
    if (r.ok) setValue('catId', r.value, { shouldValidate: true });
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (v) => {
        const r = await run(async (api) => {
          const expenseId = await api.addExpense(org.id, v);
          if (v.files.length) await uploadAfterSave(api, org.id, { kind: 'expense', id: expenseId }, v.files);
          return expenseId;
        }, 'Despesa registada');
        if (r.ok) close();
      })}
    >
      <NumberField
        label={`Valor (${cur})`}
        placeholder="0"
        className="text-xl! font-semibold"
        data-autofocus
        {...register('amount')}
        error={errors.amount?.message}
      />
      <Controller
        control={control}
        name="catId"
        render={({ field }) => (
          <Combobox
            label="Categoria"
            value={field.value}
            onChange={field.onChange}
            options={db.cats.map((c) => ({ id: c.id, label: c.name, dot: c.color }))}
            placeholder="Pesquisar categoria…"
            onCreate={createCategory}
            error={errors.catId?.message}
            leading={
              <span
                aria-hidden
                className="size-[9px] shrink-0 rounded-full"
                style={{ background: db.cats.find((c) => c.id === field.value)?.color ?? '#D0D5DD' }}
              />
            }
          />
        )}
      />
      <TextField
        label="Data"
        type="date"
        max={today}
        fieldClassName="max-w-[200px]"
        {...register('date')}
        error={errors.date?.message}
      />
      <TextAreaField
        label="Nota"
        rows={3}
        placeholder="Ex.: renda de Outubro"
        {...register('note')}
        error={errors.note?.message}
      />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-muted">Comprovativo</span>
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
        <DropButton label={`Anexar ficheiro · imagem, PDF, CSV ou Excel até ${fileSize(MAX_FILE_BYTES)}`} onClick={picker.open} />
      </div>
      <SubmitButton>Guardar despesa</SubmitButton>
    </form>
  );
}
