import { useCallback } from 'react';
import { buildExport, exportFilename, type ExportKind } from '../../domain/exports';
import { todayISO } from '../../domain/format';
import { useOrgData } from '../../hooks/useOrg';
import { exportXlsx } from '../../lib/xlsx';
import { toast } from '../../store/uiStore';

/** Returns a function that downloads an Excel export for the current filters. */
export function useExport() {
  const { org, db, derived, analytics } = useOrgData();
  return useCallback(
    (kind: ExportKind) => {
      try {
        exportXlsx(exportFilename(org.name, kind, todayISO()), buildExport(kind, db, derived, analytics));
        toast('Ficheiro Excel exportado');
      } catch {
        toast('Não foi possível exportar');
      }
    },
    [org.name, db, derived, analytics],
  );
}
