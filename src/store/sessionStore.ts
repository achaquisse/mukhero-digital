import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useFilters } from './filtersStore';

interface SessionState {
  /** The organisation currently being worked in. */
  orgId: string | null;
  enterOrg: (orgId: string) => void;
  leaveOrg: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      orgId: null,
      enterOrg: (orgId) => {
        useFilters.getState().clear();
        set({ orgId });
      },
      leaveOrg: () => set({ orgId: null }),
    }),
    { name: 'mukhero.session', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
