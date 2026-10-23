import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Avatar, Logo, OrgMark } from '../components/ui/Display';
import { Icon } from '../components/ui/Icon';
import { Popover } from '../components/ui/Menu';
import { FilterBar } from '../features/filters/FilterBar';
import { ModalHost } from '../features/modals/ModalHost';
import { OrgDataProvider } from '../hooks/OrgDataProvider';
import { useWide } from '../hooks/useMediaQuery';
import { useApi } from '../api/context';
import { useMyOrgs } from '../api/queries';
import { useOrgData, useUser } from '../hooks/useOrg';
import { useSession } from '../store/sessionStore';
import { useUi } from '../store/uiStore';
import { PATHS } from './paths';

const TABS = [
  [PATHS.painel, 'Painel', 'space_dashboard'],
  [PATHS.stock, 'Stock e lotes', 'inventory_2'],
  [PATHS.vendas, 'Vendas', 'point_of_sale'],
  [PATHS.despesas, 'Despesas', 'receipt_long'],
  [PATHS.relatorios, 'Relatórios', 'monitoring'],
] as const;

export function AppLayout() {
  const wide = useWide();
  const { pathname } = useLocation();
  const openModal = useUi((s) => s.openModal);

  return (
    <OrgDataProvider>
      <div className="relative min-h-screen">
        <header className="pointer-events-none sticky top-0 z-20 px-3.5 pt-3.5">
          <div className="pointer-events-auto relative mx-auto box-border flex h-[60px] max-w-[1180px] items-center gap-3 rounded-[22px] border border-white/95 bg-white/70 pl-2.5 pr-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(16,24,40,0.05),0_14px_40px_rgba(91,76,245,0.14)] backdrop-blur-[22px] backdrop-saturate-[180%]">
            {wide && <Logo size={28} />}
            <TabNav pathname={pathname} />
            {wide && (
              <button
                type="button"
                onClick={() => openModal({ kind: 'quick' })}
                className="brand-gradient flex shrink-0 items-center gap-1.5 rounded-[10px] border-0 px-3.5 py-2 text-sm font-[550] text-white hover:brightness-95"
              >
                <Icon name="add" size={18} />
                Novo
              </button>
            )}
            <AccountMenu wide={wide} />
          </div>
        </header>

        <main className={wide ? 'px-3.5 pb-16 pt-[18px]' : 'px-3.5 pb-[100px] pt-3.5'}>
          <div
            key={pathname}
            className="mx-auto flex max-w-[1180px] animate-[page-in_.45s_cubic-bezier(.2,.9,.25,1)] flex-col gap-4 motion-reduce:animate-none"
          >
            <FilterBar />
            <Outlet />
          </div>
        </main>

        {!wide && (
          <button
            type="button"
            aria-label="Registar"
            onClick={() => openModal({ kind: 'quick' })}
            className="brand-gradient fixed bottom-5 right-4 z-25 grid size-14 place-items-center rounded-[18px] border-0 text-white shadow-[0_8px_24px_rgba(16,24,40,0.25)] active:scale-95"
          >
            <Icon name="add" size={26} />
          </button>
        )}

        <ModalHost />
      </div>
    </OrgDataProvider>
  );
}

function TabNav({ pathname }: { pathname: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [ind, setInd] = useState({ l: 0, w: 0 });

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>(`a[href="${pathname}"]`);
      setInd(el ? { l: el.offsetLeft, w: el.offsetWidth } : { l: 0, w: 0 });
      if (el && (el.offsetLeft < nav.scrollLeft || el.offsetLeft + el.offsetWidth > nav.scrollLeft + nav.clientWidth))
        nav.scrollTo?.({ left: el.offsetLeft - 40, behavior: 'smooth' });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(nav);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro?.disconnect();
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Secções"
      className="no-scrollbar relative flex h-11 min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 rounded-[14px] bg-[linear-gradient(135deg,#8B7BFF,#5B4CF5_60%,#4A6CF7)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_rgba(91,76,245,0.38)] transition-[left,width] duration-450 ease-[cubic-bezier(.3,1.2,.4,1)]"
        style={{ left: ind.l, width: ind.w }}
      />
      {TABS.map(([to, label, icon]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative z-[1] flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[14px] px-3.5 text-sm no-underline transition-colors ${
              isActive ? 'font-semibold text-white' : 'font-medium text-muted hover:text-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={icon} size={18} filled={isActive} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function AccountMenu({ wide }: { wide: boolean }) {
  const user = useUser();
  const { org } = useOrgData();
  const orgs = useMyOrgs().data ?? [];
  const enterOrg = useSession((s) => s.enterOrg);
  const api = useApi();
  const navigate = useNavigate();

  return (
    <Popover
      className="shrink-0"
      align="right"
      panelClassName="top-[calc(100%+12px)]! w-[min(300px,calc(100vw-24px))] gap-px rounded-[18px]! border-card-line! bg-white/95! p-1.5! shadow-[0_20px_50px_rgba(91,76,245,0.18)]! backdrop-blur-[20px]"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label={`Conta e organização (${org.name})`}
          onClick={toggle}
          className={`flex items-center gap-2.5 rounded-full border bg-white py-[3px] pr-[3px] text-ink hover:border-line-strong ${
            open ? 'border-line-strong' : 'border-[#E7E9EE]'
          } ${wide ? 'pl-3' : 'pl-[3px]'}`}
        >
          {wide && <span className="max-w-[140px] truncate text-[13px] font-[550]">{org.name}</span>}
          <span className="relative">
            <Avatar initials={user.initials} size={32} />
            <span
              aria-hidden
              className="absolute -bottom-[3px] -right-[3px] grid size-4 place-items-center rounded-[5px] border-2 border-white text-[9px] font-bold text-white"
              style={{ background: org.color }}
            >
              {org.name[0]}
            </span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Conta" className="flex flex-col gap-px">
          <div className="flex items-center gap-2.5 p-2.5">
            <Avatar initials={user.initials} size={36} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-[550]">{user.name}</span>
              <span className="truncate text-xs text-muted">{user.email}</span>
            </div>
          </div>
          <div className="mx-1.5 my-0.5 h-px bg-[#EEF0F3]" />
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-[550] uppercase tracking-[0.04em] text-subtle">Organização</div>
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === org.id}
              onClick={() => {
                close();
                if (o.id !== org.id) {
                  enterOrg(o.id);
                  navigate(PATHS.painel);
                }
              }}
              className={`flex items-center gap-2.5 rounded-lg border-0 px-2.5 py-2 text-left text-ink hover:bg-hover ${
                o.id === org.id ? 'bg-hover' : 'bg-transparent'
              }`}
            >
              <OrgMark name={o.name} color={o.color} size={26} radius={7} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{o.name}</span>
                <span className="text-[11px] text-muted">{o.role}</span>
              </span>
              <Icon name="check" size={17} className="text-brand" style={{ opacity: o.id === org.id ? 1 : 0 }} />
            </button>
          ))}
          <div className="mx-1.5 my-1 h-px bg-[#EEF0F3]" />
          <MenuItem
            icon="tune"
            onClick={() => {
              close();
              navigate(PATHS.definicoes);
            }}
          >
            Definições
          </MenuItem>
          <MenuItem
            icon="logout"
            danger
            onClick={() => {
              close();
              void api.signOut();
            }}
          >
            Terminar sessão
          </MenuItem>
        </div>
      )}
    </Popover>
  );
}

function MenuItem({
  icon,
  danger,
  onClick,
  children,
}: {
  icon: string;
  danger?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-[9px] text-left text-sm ${
        danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-hover'
      }`}
    >
      <span className={`grid w-[26px] place-items-center ${danger ? '' : 'text-muted'}`}>
        <Icon name={icon} size={19} />
      </span>
      {children}
    </button>
  );
}
