import { InstallPrompt } from '../components/overlays/InstallPrompt';
import { ConfirmDialog, FilePreview, Toast } from '../components/overlays/Overlays';

export function GlobalOverlays() {
  return (
    <>
      <FilePreview />
      <ConfirmDialog />
      <Toast />
      <InstallPrompt />
    </>
  );
}
