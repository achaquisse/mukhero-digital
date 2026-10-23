import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '../features/auth/authContext';
import { useSession } from '../store/sessionStore';
import { toast } from '../store/uiStore';
import { useApi } from './context';
import type { Api } from './types';

export const keys = {
  myOrgs: (uid: string) => ['me', uid, 'orgs'] as const,
  myInvites: (uid: string) => ['me', uid, 'invites'] as const,
  myRequests: (uid: string) => ['me', uid, 'requests'] as const,
  org: (orgId: string) => ['org', orgId] as const,
};

export function useMyOrgs() {
  const api = useApi();
  const uid = useAuth().user?.id ?? '';
  return useQuery({ queryKey: keys.myOrgs(uid), queryFn: () => api.listMyOrgs(), enabled: !!uid });
}

export function useMyInvites() {
  const api = useApi();
  const uid = useAuth().user?.id ?? '';
  return useQuery({ queryKey: keys.myInvites(uid), queryFn: () => api.listMyInvites(), enabled: !!uid });
}

export function useMyJoinRequests() {
  const api = useApi();
  const uid = useAuth().user?.id ?? '';
  return useQuery({ queryKey: keys.myRequests(uid), queryFn: () => api.listMyJoinRequests(), enabled: !!uid });
}

export function useOrgQuery(orgId: string | null) {
  const api = useApi();
  return useQuery({ queryKey: keys.org(orgId ?? ''), queryFn: () => api.loadOrg(orgId!), enabled: !!orgId });
}

export type Outcome<T> = { ok: true; value: T } | { ok: false };

/**
 * Run a backend call, then refresh the affected data. Errors are shown as a
 * toast; the returned outcome says whether the call succeeded.
 */
export function useAction() {
  const api = useApi();
  const qc = useQueryClient();
  const orgId = useSession((s) => s.orgId);
  const m = useMutation({
    mutationFn: ({ fn }: { fn: (api: Api) => Promise<unknown>; success?: string; scope: 'org' | 'me' | 'all' }) => fn(api),
    onSuccess: (_d, v) => v.success && toast(v.success),
    onError: (e) => toast(e instanceof Error ? e.message : 'Ocorreu um erro'),
    onSettled: (_d, _e, v) => {
      if (v.scope !== 'me' && orgId) void qc.invalidateQueries({ queryKey: keys.org(orgId) });
      if (v.scope !== 'org') void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const run = useCallback(
    async <T>(fn: (api: Api) => Promise<T>, success?: string, scope: 'org' | 'me' | 'all' = 'org'): Promise<Outcome<T>> => {
      try {
        return { ok: true, value: (await m.mutateAsync({ fn, success, scope })) as T };
      } catch {
        return { ok: false };
      }
    },
    [m],
  );
  return { run, pending: m.isPending };
}
