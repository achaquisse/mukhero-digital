interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'install-dismissed-at';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function subscribeInstall(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallMode = 'native' | 'ios' | null;

/** How the app can be installed right now: via the browser prompt, via iOS "Add to Home Screen", or not at all. */
export function installMode(): InstallMode {
  if (typeof window === 'undefined' || installed || isStandalone()) return null;
  const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  if (at && Date.now() - at < DISMISS_FOR_MS) return null;
  if (deferred) return 'native';
  return isIos() ? 'ios' : null;
}

export function dismissInstall() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  emit();
}

export async function promptInstall() {
  const e = deferred;
  if (!e) return;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'dismissed') dismissInstall();
  else emit();
}
