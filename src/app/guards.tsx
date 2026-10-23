import { Navigate, Outlet } from 'react-router';
import { useMyOrgs } from '../api/queries';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../features/auth/authContext';
import { useSession } from '../store/sessionStore';
import { GlobalOverlays } from './GlobalOverlays';
import { PATHS } from './paths';

export function RequireUser() {
  const { user } = useAuth();
  if (user === undefined) return <Spinner />;
  return user ? <Outlet /> : <Navigate to={PATHS.signIn} replace />;
}

export function RequireOrg() {
  const orgId = useSession((s) => s.orgId);
  const orgs = useMyOrgs();
  if (!orgId) return <Navigate to={PATHS.orgs} replace />;
  if (orgs.isPending) return <Spinner />;
  return orgs.data?.some((o) => o.id === orgId) ? <Outlet /> : <Navigate to={PATHS.orgs} replace />;
}

export function GuestOnly() {
  const { user } = useAuth();
  if (user === undefined) return <Spinner />;
  return user ? <Navigate to={PATHS.orgs} replace /> : <Outlet />;
}

export function Root() {
  return (
    <>
      <Outlet />
      <GlobalOverlays />
    </>
  );
}
