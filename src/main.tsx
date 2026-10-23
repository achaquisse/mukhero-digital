import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { Api } from './api/types';
import { AppProviders } from './app/AppProviders';
import { routes } from './app/routes';
import './index.css';

/** VITE_API=memory runs the app offline against seeded in-memory data. */
async function loadApi(): Promise<Api> {
  if (import.meta.env.VITE_API === 'memory') {
    const { createMemoryApi } = await import('./api/memoryApi');
    return createMemoryApi(undefined, { latencyMs: 150 });
  }
  return (await import('./api/supabaseApi')).supabaseApi;
}

const router = createBrowserRouter(routes);

loadApi().then((api) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders api={api}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  ),
);
