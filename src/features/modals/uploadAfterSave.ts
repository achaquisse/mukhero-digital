import type { Api, AttachTarget } from '../../api/types';
import type { DraftFile } from '../../domain/types';
import { toast } from '../../store/uiStore';

/**
 * Upload draft files for a record that was just saved. A failed upload must not
 * fail the save (the user would retry and duplicate the record), so it only warns.
 */
export async function uploadAfterSave(api: Api, orgId: string, target: AttachTarget, drafts: DraftFile[]) {
  try {
    await api.uploadAttachments(
      orgId,
      target,
      drafts.map((d) => d.file),
    );
  } catch (e) {
    toast(`Registo guardado, mas o anexo falhou: ${e instanceof Error ? e.message : ''}`);
  }
}
