import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { makeQueryClient } from './queryClient';
import { useState, type ReactNode } from 'react';
import { ApiContext } from '../api/context';
import type { Api } from '../api/types';
import { AuthProvider } from '../features/auth/AuthProvider';

export function AppProviders({ api, client, children }: { api: Api; client?: QueryClient; children: ReactNode }) {
  const [qc] = useState(() => client ?? makeQueryClient());
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={qc}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
