import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { AUTO_ENTER_PARAM, PATHS } from '../../app/paths';
import { Button } from '../../components/ui/Button';
import { Badge, Logo, OrgMark } from '../../components/ui/Display';
import { FieldError } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { createOrgSchema, joinOrgSchema } from '../../domain/schemas';
import { useUser } from '../../hooks/useOrg';
import { useApi } from '../../api/context';
import { useAction, useMyInvites, useMyJoinRequests, useMyOrgs } from '../../api/queries';
import { Spinner } from '../../components/ui/Spinner';
import { PALETTE } from '../../domain/constants';
import { useSession } from '../../store/sessionStore';
import { useUi } from '../../store/uiStore';

type Mode = 'create' | 'join' | null;

export function OrgsPage() {
  const user = useUser();
  const api = useApi();
  const { run } = useAction();
  const orgsQ = useMyOrgs();
  const invitesQ = useMyInvites();
  const requestsQ = useMyJoinRequests();
  const enterOrg = useSession((s) => s.enterOrg);
  const orgs = orgsQ.data ?? [];
  const invitesIn = invitesQ.data ?? [];
  const requestsOut = requestsQ.data ?? [];
  const ask = useUi((s) => s.ask);
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const autoEnter = searchParams.has(AUTO_ENTER_PARAM);
  const soleOrgId = orgsQ.isSuccess && orgs.length === 1 ? orgs[0]!.id : null;

  const enter = (id: string) => {
    enterOrg(id);
    navigate(PATHS.painel);
  };

  useEffect(() => {
    if (!autoEnter || orgsQ.isPending) return;
    if (soleOrgId) {
      enterOrg(soleOrgId);
      navigate(PATHS.painel, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [autoEnter, orgsQ.isPending, soleOrgId, enterOrg, navigate, setSearchParams]);

  if (autoEnter && (orgsQ.isPending || soleOrgId)) return <Spinner />;

  return (
    <main className="box-border flex min-h-dvh justify-center px-4 py-10">
      <div className="flex w-full max-w-[540px] flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <Logo size={36} />
          <button
            type="button"
            onClick={() => void api.signOut()}
            className="flex items-center gap-1.5 border-0 bg-transparent text-sm text-muted hover:text-ink"
          >
            <Icon name="logout" size={18} />
            Sair
          </button>
        </div>
        <div className="flex flex-col gap-1.5 px-0.5 pb-1.5 pt-3">
          <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em]">Olá, {user.name.split(' ')[0]}</h1>
          <div className="text-sm text-muted">{user.email} · escolha onde quer trabalhar</div>
        </div>

        {orgsQ.isPending && <Spinner />}
        {orgs.length > 0 && (
          <section className="card flex flex-col" aria-labelledby="orgs-mine">
            <h2 id="orgs-mine" className="m-0 px-4 pb-1.5 pt-3 text-xs font-[550] text-muted">
              As suas organizações
            </h2>
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => enter(o.id)}
                className="flex items-center gap-3 border-0 bg-transparent px-4 py-3 text-left text-ink hover:bg-[#FAFBFC]"
              >
                <OrgMark name={o.name} color={o.color} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-[550]">{o.name}</span>
                  <span className="text-[13px] text-muted">
                    {o.role}
                    {o.members != null && ` · ${o.members} membros`}
                  </span>
                </span>
                <Icon name="chevron_right" size={20} className="text-subtle" />
              </button>
            ))}
          </section>
        )}

        {invitesIn.length > 0 && (
          <section className="card flex flex-col" aria-labelledby="orgs-invites">
            <h2 id="orgs-invites" className="m-0 px-4 pb-1.5 pt-3 text-xs font-[550] text-muted">
              Convites
            </h2>
            {invitesIn.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#EEF3FF] text-brand">
                  <Icon name="mail" size={19} />
                </span>
                <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                  <div className="text-[15px] font-[550]">{i.org}</div>
                  <div className="text-[13px] text-muted">
                    {i.by} convidou-o como {i.role}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      ask({
                        title: 'Recusar convite?',
                        message: `Não se juntará a ${i.org}. Será necessário um novo convite.`,
                        confirmLabel: 'Recusar convite',
                        onConfirm: () => void run((a) => a.declineInvite(i.id), undefined, 'me'),
                      })
                    }
                  >
                    Recusar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void run((a) => a.acceptInvite(i.id), `Juntou-se a ${i.org}`, 'me');
                    }}
                  >
                    Aceitar
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        {requestsOut.length > 0 && (
          <section className="card flex flex-col" aria-labelledby="orgs-requests">
            <h2 id="orgs-requests" className="m-0 px-4 pb-1.5 pt-3 text-xs font-[550] text-muted">
              Pedidos de acesso enviados
            </h2>
            {requestsOut.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-[#F1F2F5] px-4 py-[11px]">
                <div className="min-w-0 flex-1 text-sm">{r.org}</div>
                <Badge bg="#FFF4E5" color="#B45309">
                  Pendente
                </Badge>
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <ModeCard
            active={mode === 'create'}
            icon="add_business"
            title="Criar organização"
            sub="Comece como administrador"
            onClick={() => setMode(mode === 'create' ? null : 'create')}
          />
          <ModeCard
            active={mode === 'join'}
            icon="group_add"
            title="Pedir acesso"
            sub="Junte-se a uma equipa"
            onClick={() => setMode(mode === 'join' ? null : 'join')}
          />
        </div>
        {mode === 'create' && (
          <CreateOrgForm
            nextColor={PALETTE[orgs.length % PALETTE.length]!}
            onCreated={(id) => {
              enterOrg(id);
              navigate(PATHS.painel);
            }}
          />
        )}
        {mode === 'join' && <JoinOrgForm onSent={() => setMode(null)} />}
      </div>
    </main>
  );
}

function ModeCard(p: { active: boolean; icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={p.active}
      onClick={p.onClick}
      className={`flex flex-col items-start gap-3 rounded-[14px] border bg-white p-4 text-left text-ink ${
        p.active ? 'border-ink' : 'border-[#E7E9EE]'
      }`}
    >
      <Icon name={p.icon} size={22} />
      <span className="flex flex-col gap-[3px]">
        <span className="text-sm font-semibold">{p.title}</span>
        <span className="text-xs text-muted">{p.sub}</span>
      </span>
    </button>
  );
}

function CreateOrgForm({ onCreated, nextColor }: { onCreated: (id: string) => void; nextColor: string }) {
  const { run } = useAction();
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof createOrgSchema>,
    unknown,
    z.output<typeof createOrgSchema>
  >({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: '' },
  });
  const err = formState.errors.name?.message;
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async ({ name }) => {
        const r = await run((a) => a.createOrg(name, nextColor), `${name} criada`, 'me');
        if (r.ok) onCreated(r.value);
      })}
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <input
          {...register('name')}
          autoFocus
          aria-label="Nome da organização"
          aria-invalid={!!err}
          aria-describedby={err ? 'create-org-err' : undefined}
          placeholder="Nome da organização"
          className="field flex-1 py-[11px]!"
        />
        <Button type="submit" variant="primary" size="md" className="px-4!">
          Criar
        </Button>
      </div>
      <FieldError id="create-org-err" message={err} />
    </form>
  );
}

function JoinOrgForm({ onSent }: { onSent: () => void }) {
  const { run } = useAction();
  const { register, handleSubmit, formState } = useForm<z.input<typeof joinOrgSchema>, unknown, z.output<typeof joinOrgSchema>>({
    resolver: zodResolver(joinOrgSchema),
    defaultValues: { code: '' },
  });
  const err = formState.errors.code?.message;
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async ({ code }) => {
        const r = await run((a) => a.requestJoin(code), undefined, 'me');
        if (r.ok) {
          useUi.getState().showToast(`Pedido enviado aos administradores de ${r.value}`);
          onSent();
        }
      })}
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <input
          {...register('code')}
          autoFocus
          aria-label="Nome ou código de convite"
          aria-invalid={!!err}
          aria-describedby={err ? 'join-org-err' : undefined}
          placeholder="Nome ou código de convite"
          className="field flex-1 py-[11px]!"
        />
        <Button type="submit" variant="primary" size="md" className="px-4!">
          Enviar pedido
        </Button>
      </div>
      <FieldError id="join-org-err" message={err} />
    </form>
  );
}

export default OrgsPage;
