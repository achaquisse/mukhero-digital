import type { DataRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { useUi } from '../store/uiStore';

const CHECK_EVERY_MS = 30 * 60 * 1000;

const busy = () => {
  const s = useUi.getState();
  return !!(s.modal || s.confirm || s.preview);
};

/**
 * Registers the service worker and applies new versions automatically. A pending update is
 * activated (with a reload) at a safe moment: on the next route change or when the app is
 * backgrounded, never while a modal, confirmation or preview is open.
 */
export function setupPwa(router: Pick<DataRouter, 'subscribe' | 'state'>) {
  if (!('serviceWorker' in navigator)) return;

  let pending = false;
  const apply = () => {
    if (!pending || busy()) return;
    pending = false;
    void updateSW(true);
  };

  const updateSW = registerSW({
    onNeedRefresh() {
      pending = true;
      if (document.visibilityState === 'hidden') apply();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (reg.installing || !navigator.onLine) return;
        reg.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  let locationKey = router.state.location.key;
  router.subscribe((state) => {
    if (state.navigation.state !== 'idle' || state.location.key === locationKey) return;
    locationKey = state.location.key;
    apply();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') apply();
  });
}
