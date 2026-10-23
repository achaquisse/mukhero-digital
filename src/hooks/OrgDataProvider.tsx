import { useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMyOrgs, useOrgQuery } from '../api/queries';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { computeAnalytics } from '../domain/analytics';
import { deriveOrg } from '../domain/derive';
import { todayISO } from '../domain/format';
import { useFilters } from '../store/filtersStore';
import { useSession } from '../store/sessionStore';
import { OrgDataContext } from './orgDataContext';

/** Loads the current org and computes derived data + filtered analytics once for the shell. */
export function OrgDataProvider({ children }: { children: ReactNode }) {
  const orgId = useSession((s) => s.orgId);
  const orgs = useMyOrgs();
  const query = useOrgQuery(orgId);
  const filters = useFilters(useShallow((s) => ({ range: s.range, productId: s.productId, typeId: s.typeId, catId: s.catId })));
  const org = orgs.data?.find((o) => o.id === orgId);
  const db = query.data;
  const today = todayISO();
  const derived = useMemo(() => (db ? deriveOrg(db, today) : null), [db, today]);
  const analytics = useMemo(
    () => (db && derived ? computeAnalytics(db, derived, filters, today) : null),
    [db, derived, filters, today],
  );
  const value = useMemo(
    () => (org && db && derived && analytics ? { org, db, derived, analytics } : null),
    [org, db, derived, analytics],
  );

  if (query.isError)
    return (
      <div role="alert" className="grid min-h-[50vh] place-items-center text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="m-0 text-sm text-muted">Não foi possível carregar os dados. {query.error.message}</p>
          <Button onClick={() => query.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  if (!value) return <Spinner />;
  return <OrgDataContext.Provider value={value}>{children}</OrgDataContext.Provider>;
}
