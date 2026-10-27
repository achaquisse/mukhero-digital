import { useSyncExternalStore } from 'react';
import { dismissInstall, installMode, promptInstall, subscribeInstall } from '../../lib/install';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';

/** Invites the user to install the app: native prompt where supported, Share-sheet instructions on iOS. */
export function InstallPrompt() {
  const mode = useSyncExternalStore(subscribeInstall, installMode, () => null);
  if (!mode) return null;

  return (
    <aside
      aria-label="Instalar aplicação"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-26 mx-auto flex max-w-[480px] items-start gap-3 rounded-2xl border border-card-line bg-white/95 p-3.5 shadow-[0_20px_50px_rgba(91,76,245,0.18)] backdrop-blur-[20px]"
    >
      <img src="/pwa-64x64.png" alt="" width={40} height={40} className="shrink-0 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold">Instalar Mukhero Digital</span>
        {mode === 'ios' ? (
          <span className="text-[13px] leading-snug text-muted">
            Toque em <Icon name="ios_share" size={16} className="align-[-3px] text-brand" /> <b>Partilhar</b> e depois em{' '}
            <Icon name="add_box" size={16} className="align-[-3px] text-brand" /> <b>Adicionar ao ecrã principal</b>.
          </span>
        ) : (
          <>
            <span className="text-[13px] leading-snug text-muted">Acesso rápido a partir do ecrã principal, mesmo sem rede.</span>
            <Button variant="primary" icon="download" className="mt-1 self-start" onClick={() => void promptInstall()}>
              Instalar
            </Button>
          </>
        )}
      </div>
      <IconButton icon="close" label="Agora não" size={30} onClick={dismissInstall} />
    </aside>
  );
}
