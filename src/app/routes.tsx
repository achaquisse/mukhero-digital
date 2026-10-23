import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './AppLayout';
import { GuestOnly, RequireOrg, RequireUser, Root } from './guards';
import { PATHS } from './paths';

/** Route-level code splitting: each screen is its own chunk. */
const page = (load: () => Promise<{ default: React.ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <GuestOnly />,
        children: [{ path: PATHS.signIn, ...page(() => import('../features/auth/SignInPage')) }],
      },
      {
        element: <RequireUser />,
        children: [
          { path: PATHS.orgs, ...page(() => import('../features/orgs/OrgsPage')) },
          {
            element: <RequireOrg />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  { path: PATHS.painel, ...page(() => import('../features/dashboard/DashboardPage')) },
                  { path: PATHS.stock, ...page(() => import('../features/stock/StockPage')) },
                  { path: PATHS.vendas, ...page(() => import('../features/sales/SalesPage')) },
                  { path: PATHS.despesas, ...page(() => import('../features/expenses/ExpensesPage')) },
                  { path: PATHS.relatorios, ...page(() => import('../features/reports/ReportsPage')) },
                  { path: PATHS.definicoes, ...page(() => import('../features/settings/SettingsPage')) },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to={PATHS.painel} replace /> },
    ],
  },
];
