import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useApi } from '../../api/context';
import type { User } from '../../domain/types';
import { AuthContext } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    api.currentUser().then((u) => active && setUser((prev) => (prev === undefined ? u : prev)));
    const off = api.onAuthChange((u) => {
      setUser((prev) => {
        // Drop cached data from the previous account.
        if (prev?.id !== u?.id) queryClient.clear();
        return u;
      });
    });
    return () => {
      active = false;
      off();
    };
  }, [api, queryClient]);

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}
