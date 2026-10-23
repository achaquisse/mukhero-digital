import { useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { TextField } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { PALETTE, ROLE_DESCRIPTIONS, ROLES } from '../../domain/constants';
import * as M from '../../domain/mutations';
import { makeInviteSchema, makeNamedSchema } from '../../domain/schemas';
import { useAction, useOrgData } from '../../hooks/useOrg';
import { useUi } from '../../store/uiStore';
import { SubmitButton } from './formKit';
import { useZodForm } from './useZodForm';

export function NamedForm({ kind }: { kind: 'type' | 'cat' }) {
  const { org, db } = useOrgData();
  const { run } = useAction();
  const close = useUi((s) => s.closeModal);
  const isType = kind === 'type';
  const list = isType ? db.types : db.cats;
  const schema = useMemo(
    () =>
      makeNamedSchema({
        taken: (n) => M.nameTaken(list, n),
        required: 'Indique um nome',
        duplicate: `Já existe ${isType ? 'um tipo' : 'uma categoria'} com este nome`,
      }),
    [list, isType],
  );
  const { register, control, handleSubmit, formState } = useZodForm(schema, {
    mode: 'onChange',
    defaultValues: { name: '', color: PALETTE[db.cats.length % PALETTE.length] },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async ({ name, color }) => {
        const r = isType
          ? await run((api) => api.addType(org.id, name), `Tipo «${name}» adicionado`)
          : await run((api) => api.addCategory(org.id, name, color ?? PALETTE[0]!), `Categoria «${name}» adicionada`);
        if (r.ok) close();
      })}
    >
      <TextField
        label={isType ? 'Nome do tipo' : 'Nome da categoria'}
        placeholder={isType ? 'Ex.: Iluminação' : 'Ex.: Combustível'}
        {...register('name')}
        error={formState.errors.name?.message}
      />
      {!isType && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted" id="cat-color-label">
            Cor
          </span>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <div role="radiogroup" aria-labelledby="cat-color-label" className="flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={field.value === c}
                    aria-label={c}
                    onClick={() => field.onChange(c)}
                    className="grid size-8 place-items-center rounded-full border-2 bg-white p-0"
                    style={{ borderColor: field.value === c ? c : 'transparent' }}
                  >
                    <span className="size-[22px] rounded-full" style={{ background: c }} />
                  </button>
                ))}
              </div>
            )}
          />
        </div>
      )}
      <SubmitButton>{isType ? 'Adicionar tipo' : 'Adicionar categoria'}</SubmitButton>
    </form>
  );
}

export function InviteForm() {
  const { org, db } = useOrgData();
  const { run } = useAction();
  const close = useUi((s) => s.closeModal);
  const schema = useMemo(() => makeInviteSchema((em) => M.inviteError(db, em)), [db]);
  const { register, control, handleSubmit, formState } = useZodForm(schema, {
    defaultValues: { email: '', role: 'Vendas' },
  });
  const role = useWatch({ control, name: 'role' });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (v) => {
        if ((await run((api) => api.inviteMember(org.id, v.email, v.role), `Convite enviado para ${v.email.toLowerCase()}`)).ok)
          close();
      })}
    >
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="nome@empresa.co.mz"
        {...register('email')}
        error={formState.errors.email?.message}
      />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-muted">Função</span>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Segmented
              label="Função"
              stretch
              options={ROLES.map((r) => [r, r] as const)}
              value={field.value}
              onChange={field.onChange}
              className="[&>button]:py-[7px]"
            />
          )}
        />
        <span className="text-xs text-muted">{ROLE_DESCRIPTIONS[role]}</span>
      </div>
      <SubmitButton>Enviar convite</SubmitButton>
    </form>
  );
}
