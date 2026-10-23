import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createMemoryApi, demoState, type MemoryApi, type MemoryState } from '../api/memoryApi';
import { AppProviders } from '../app/AppProviders';
import { routes } from '../app/routes';
import { DEMO_USER } from '../domain/seed';
import { useFilters } from '../store/filtersStore';
import { useSession } from '../store/sessionStore';
import { useUi } from '../store/uiStore';

const base = demoState();

interface Options {
  signedIn?: boolean;
  orgId?: string | null;
  state?: Partial<MemoryState>;
}

/** Render the full app (real router + forms) against a fresh in-memory backend. */
export function renderApp(path = '/painel', { signedIn = true, orgId = 'o1', state }: Options = {}) {
  const api: MemoryApi = createMemoryApi({
    ...structuredClone({ ...base, files: undefined }),
    files: new Map(),
    user: signedIn ? DEMO_USER : null,
    ...state,
  } as MemoryState);
  useSession.setState({ orgId });
  useUi.setState({ modal: null, toast: null, confirm: null, preview: null });
  useFilters.getState().clear();

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: 0 } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const view = render(
    <AppProviders api={api} client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  /** Current data of an org in the fake backend. */
  const db = (id = 'o1') => api.state.db[id]!;
  return { user, router, api, db, ...view };
}
