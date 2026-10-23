import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';
import { PATHS } from '../../app/paths';
import { Button, IconButton } from '../../components/ui/Button';
import { Avatar, Badge, Dot, OrgMark, SectionHeader } from '../../components/ui/Display';
import { TextField } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Segmented } from '../../components/ui/Segmented';
import { CURRENCIES, CURRENCY_LABELS, ROLES } from '../../domain/constants';
import { sum } from '../../domain/derive';
import { dayLabelYear, fmt } from '../../domain/format';
import { orgSettingsSchema } from '../../domain/schemas';
import { useAction, useOrgData, useUser } from '../../hooks/useOrg';
import { useSession } from '../../store/sessionStore';
import { useUi } from '../../store/uiStore';

export function SettingsPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <OrgSection />
      <TypesSection />
      <CategoriesSection />
      <TeamSection />
      <section className="card flex flex-col overflow-hidden">
        <SectionHeader
          title="Organizações"
          sub="Trabalha com outro negócio? Crie uma nova organização ou peça acesso a uma existente."
          action={<GoOrgsButton />}
        />
      </section>
      <DangerZone />
    </div>
  );
}

function GoOrgsButton() {
  const navigate = useNavigate();
  const leaveOrg = useSession((s) => s.leaveOrg);
  return (
    <Button
      icon="add_business"
      iconColor="#6B7280"
      className="py-2!"
      onClick={() => {
        leaveOrg();
        navigate(PATHS.orgs);
      }}
    >
      Criar ou juntar-se
    </Button>
  );
}

type OrgForm = z.input<typeof orgSettingsSchema>;

function OrgSection() {
  const { org, db } = useOrgData();
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, formState, control, setValue, reset } = useForm<
    OrgForm,
    unknown,
    z.output<typeof orgSettingsSchema>
  >({
    resolver: zodResolver(orgSettingsSchema),
    values: { name: org.name, currency: db.settings.currency },
  });
  const currency = useWatch({ control, name: 'currency' });

  return (
    <section className="card flex flex-col">
      <SectionHeader
        title="Organização"
        sub="Identificação e moeda usada em todos os valores"
        action={
          !editing && (
            <Button icon="edit" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )
        }
      />
      {!editing ? (
        <dl className="m-0 grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          <Info label="Nome da organização">
            <span className="flex items-center gap-2.5">
              <OrgMark name={org.name} color={org.color} size={26} radius={7} />
              {org.name}
            </span>
          </Info>
          <Info label="Moeda">{CURRENCY_LABELS[db.settings.currency]}</Info>
          <Info label="A sua função">{org.role}</Info>
          <Info label="Código de acesso">
            <span className="font-mono tracking-[0.08em]" title="Partilhe este código para pedirem acesso">
              {org.joinCode}
            </span>
          </Info>
        </dl>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4 p-4"
          onSubmit={handleSubmit(async (v) => {
            const r = await run((api) => api.updateOrg(org.id, v), 'Definições da organização guardadas', 'all');
            if (r.ok) setEditing(false);
          })}
        >
          <div className="grid items-end gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
            <TextField label="Nome da organização" {...register('name')} error={formState.errors.name?.message} />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-muted" id="currency-label">
                Moeda
              </span>
              <Segmented
                label="Moeda"
                size="md"
                className="self-start"
                options={CURRENCIES.map((c) => [c, c] as const)}
                value={currency}
                onChange={(c) => setValue('currency', c, { shouldDirty: true })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar alterações
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 text-[15px] font-[550] leading-[26px]">{children}</dd>
    </div>
  );
}

type Head = string | [label: string, align: 'right'];

/** Simple grid table used by the settings lists. */
function MiniTable({
  cols,
  head,
  children,
  minWidth = 640,
}: {
  cols: string;
  head: Head[];
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div role="table" className="px-1.5 pb-1.5" style={{ minWidth }}>
        <div
          role="row"
          className="mt-1.5 grid rounded-[10px] bg-surface text-xs font-[550] text-muted"
          style={{ gridTemplateColumns: cols }}
        >
          {head.map((h, i) => {
            const [label, align] = typeof h === 'string' ? [h, 'left'] : h;
            return (
              <div key={i} role="columnheader" className={`px-3.5 py-2.5 ${align === 'right' ? 'text-right' : ''}`}>
                {label}
              </div>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}

function TypesSection() {
  const { db, derived } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const ask = useUi((s) => s.ask);
  const { run } = useAction();
  const cols = 'minmax(180px,2fr) minmax(110px,1fr) minmax(130px,1fr) minmax(130px,1fr) 56px';
  return (
    <section className="card flex flex-col overflow-hidden">
      <SectionHeader
        title="Tipos de produto"
        sub="Agrupam produtos nos filtros e relatórios"
        action={
          <Button icon="add" onClick={() => openModal({ kind: 'type' })}>
            Novo tipo
          </Button>
        }
      />
      <MiniTable cols={cols} head={['Tipo', ['Produtos', 'right'], ['Em stock', 'right'], ['Margem média', 'right'], '']}>
        {db.types.map((t) => {
          const tp = derived.products.filter((p) => p.typeId === t.id);
          const withCost = tp.filter((p) => p.hasCost && p.price);
          return (
            <div
              key={t.id}
              role="row"
              className="grid items-center rounded-[10px] border-b border-[#F4F5F7] text-sm hover:bg-[#FAFAFF]"
              style={{ gridTemplateColumns: cols }}
            >
              <div role="cell" className="flex min-w-0 items-center gap-2.5 px-3.5 py-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name="label" size={16} />
                </span>
                <span className="truncate font-medium">{t.name}</span>
              </div>
              <div role="cell" className="px-3.5 py-2 text-right">
                {tp.length}
              </div>
              <div role="cell" className="px-3.5 py-2 text-right text-muted">
                {fmt(sum(tp, (p) => p.onHand))} un.
              </div>
              <div role="cell" className="px-3.5 py-2 text-right text-muted">
                {withCost.length ? `${Math.round(sum(withCost, (p) => p.marginP) / withCost.length)}%` : '—'}
              </div>
              <div role="cell" className="flex justify-center">
                <IconButton
                  icon="delete"
                  tone="danger"
                  label={`Remover tipo ${t.name}`}
                  onClick={() =>
                    ask({
                      title: 'Remover tipo de produto?',
                      message: `O tipo «${t.name}» será removido. Os produtos associados ficam sem tipo.`,
                      confirmLabel: 'Remover',
                      onConfirm: () => void run((api) => api.removeType(t.id), `Tipo «${t.name}» removido`),
                    })
                  }
                />
              </div>
            </div>
          );
        })}
        {!db.types.length && <div className="px-3.5 py-4 text-sm text-muted">Sem tipos de produto.</div>}
      </MiniTable>
    </section>
  );
}

function CategoriesSection() {
  const { db } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const ask = useUi((s) => s.ask);
  const { run } = useAction();
  const cur = db.settings.currency;
  const cols = 'minmax(180px,2fr) minmax(110px,1fr) minmax(130px,1fr) minmax(160px,1.4fr) 56px';
  return (
    <section className="card flex flex-col overflow-hidden">
      <SectionHeader
        title="Categorias de despesa"
        sub="Usadas ao registar despesas"
        action={
          <Button icon="add" onClick={() => openModal({ kind: 'cat' })}>
            Nova categoria
          </Button>
        }
      />
      <MiniTable cols={cols} head={['Categoria', ['Registos', 'right'], [`Total (${cur})`, 'right'], 'Última despesa', '']}>
        {db.cats.map((c) => {
          const cx = db.expenses.filter((x) => x.catId === c.id);
          const last = cx
            .map((x) => x.date)
            .toSorted()
            .pop();
          return (
            <div
              key={c.id}
              role="row"
              className="grid items-center rounded-[10px] border-b border-[#F4F5F7] text-sm hover:bg-[#FAFAFF]"
              style={{ gridTemplateColumns: cols }}
            >
              <div role="cell" className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
                <Dot color={c.color} size={9} />
                <span className="truncate font-medium">{c.name}</span>
              </div>
              <div role="cell" className="px-3.5 py-2.5 text-right">
                {cx.length}
              </div>
              <div role="cell" className="px-3.5 py-2.5 text-right font-[550]">
                {fmt(sum(cx, (x) => x.amount))}
              </div>
              <div role="cell" className="px-3.5 py-2.5 text-muted">
                {last ? dayLabelYear(last) : '—'}
              </div>
              <div role="cell" className="flex justify-center">
                <IconButton
                  icon="delete"
                  tone="danger"
                  label={`Remover categoria ${c.name}`}
                  onClick={() =>
                    ask({
                      title: 'Remover categoria?',
                      message: `A categoria «${c.name}» será removida. As despesas existentes ficam sem categoria.`,
                      confirmLabel: 'Remover categoria',
                      onConfirm: () => void run((api) => api.removeCategory(c.id), `Categoria «${c.name}» removida`),
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </MiniTable>
    </section>
  );
}

function TeamSection() {
  const { org, db } = useOrgData();
  const user = useUser();
  const openModal = useUi((s) => s.openModal);
  const ask = useUi((s) => s.ask);
  const { run } = useAction();
  const cols = 'minmax(180px,2fr) minmax(180px,2fr) minmax(230px,1.4fr) 48px';
  const sub = `${db.members.length} membros${db.invites.length ? ` · ${db.invites.length} convites pendentes` : ''}`;

  return (
    <section className="card flex flex-col">
      <SectionHeader
        title="Equipa"
        sub={sub}
        action={
          <Button variant="primary" icon="person_add" className="px-[13px]! py-2!" onClick={() => openModal({ kind: 'invite' })}>
            Convidar
          </Button>
        }
      />
      {db.joinReqs.length > 0 && (
        <div className="flex flex-col border-b border-divider bg-surface-2">
          <h3 className="m-0 px-4 pb-0.5 pt-2.5 text-xs font-[550] text-muted">Pedidos de acesso</h3>
          {db.joinReqs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 pb-2.5 pt-2">
              <div className="flex min-w-40 flex-1 flex-col gap-px">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted">{r.email} · via Google</div>
              </div>
              <Button
                onClick={() =>
                  ask({
                    title: 'Recusar pedido de acesso?',
                    message: `${r.name} não terá acesso a esta organização.`,
                    confirmLabel: 'Recusar',
                    onConfirm: () => void run((api) => api.denyJoin(r.id)),
                  })
                }
              >
                Recusar
              </Button>
              <Button
                variant="primary"
                className="px-[13px]!"
                onClick={() => void run((api) => api.approveJoin(r.id), `${r.name} adicionado à equipa`)}
              >
                Aprovar
              </Button>
            </div>
          ))}
        </div>
      )}
      <MiniTable cols={cols} head={['Nome', 'Email', 'Função', '']} minWidth={660}>
        {db.members.map((m) => {
          const isMe = m.userId === user.id;
          return (
            <div
              key={m.userId}
              role="row"
              className="grid items-center rounded-[10px] text-sm hover:bg-[#FAFAFF]"
              style={{ gridTemplateColumns: cols }}
            >
              <div role="cell" className="flex min-w-0 items-center gap-2.5 px-3 py-[9px]">
                <Avatar initials={m.initials} src={m.avatarUrl} size={28} />
                <span className="truncate">{m.name}</span>
                {isMe && (
                  <Badge bg="#EFEDFF" color="#5B4CF5" className="px-[7px]! py-0.5! text-[11px]! font-semibold!">
                    Você
                  </Badge>
                )}
              </div>
              <div role="cell" className="truncate px-3 py-[9px] text-muted">
                {m.email || '—'}
              </div>
              <div role="cell" className="px-3 py-[7px]">
                <Segmented
                  label={`Função de ${m.name}`}
                  size="xs"
                  className="inline-flex"
                  options={ROLES.map((r) => [r, r] as const)}
                  value={m.role}
                  onChange={(role) => void run((api) => api.setMemberRole(org.id, m.userId, role))}
                />
              </div>
              <div role="cell" className="flex justify-center">
                {!isMe && (
                  <IconButton
                    icon="person_remove"
                    tone="danger"
                    label={`Remover ${m.name}`}
                    onClick={() =>
                      ask({
                        title: 'Remover membro?',
                        message: `${m.name} perderá o acesso a ${org.name}. Os registos que criou mantêm-se.`,
                        confirmLabel: 'Remover membro',
                        onConfirm: () => void run((api) => api.removeMember(org.id, m.userId), `${m.name} removido da equipa`),
                      })
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
        {db.invites.map((iv) => (
          <div key={iv.id} role="row" className="grid items-center text-sm text-muted" style={{ gridTemplateColumns: cols }}>
            <div role="cell" className="flex items-center gap-2.5 px-3 py-[9px]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-line-strong">
                <Icon name="schedule_send" size={15} />
              </span>
              Convite pendente
            </div>
            <div role="cell" className="truncate px-3 py-[9px]">
              {iv.email}
            </div>
            <div role="cell" className="px-3 py-[9px]">
              {iv.role}
            </div>
            <div role="cell" className="flex justify-center">
              <IconButton
                icon="close"
                tone="danger"
                label={`Cancelar convite para ${iv.email}`}
                onClick={() =>
                  ask({
                    title: 'Cancelar convite?',
                    message: `O convite para ${iv.email} deixará de ser válido.`,
                    confirmLabel: 'Cancelar convite',
                    onConfirm: () => void run((api) => api.cancelInvite(iv.id)),
                  })
                }
              />
            </div>
          </div>
        ))}
      </MiniTable>
    </section>
  );
}

function DangerZone() {
  const { org } = useOrgData();
  const { run } = useAction();
  const leaveOrg = useSession((s) => s.leaveOrg);
  const ask = useUi((s) => s.ask);
  const navigate = useNavigate();
  if (org.role !== 'Admin') return null;
  return (
    <section
      className="flex flex-col overflow-hidden rounded-[14px] border border-[#FECDCA] bg-white"
      aria-labelledby="danger-title"
    >
      <div className="flex items-center gap-2 border-b border-danger-line bg-[#FFFBFA] px-4 py-3.5">
        <Icon name="warning" size={19} className="text-danger-strong" />
        <h2 id="danger-title" className="m-0 text-[15px] font-semibold text-danger">
          Danger zone
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-[3px]">
          <div className="text-sm font-semibold">Remover a organização</div>
          <div className="text-[13px] leading-[1.45] text-pretty text-muted">
            Elimina {org.name} e todos os seus produtos, lotes, vendas, despesas e anexos para todos os membros. Não pode ser
            desfeito.
          </div>
        </div>
        <Button
          variant="danger"
          icon="delete_forever"
          className="px-3.5! py-[9px]!"
          onClick={() =>
            ask({
              title: 'Remover a organização?',
              message: `«${org.name}» e todos os seus dados — produtos, lotes, vendas, despesas e anexos — serão eliminados para todos os membros. Esta ação não pode ser desfeita.`,
              confirmLabel: 'Remover organização',
              onConfirm: async () => {
                const r = await run((api) => api.deleteOrg(org.id), `${org.name} foi removida`, 'me');
                if (r.ok) {
                  leaveOrg();
                  navigate(PATHS.orgs);
                }
              },
            })
          }
        >
          Remover organização
        </Button>
      </div>
    </section>
  );
}

export default SettingsPage;
