import type { RouteObject } from 'react-router-dom';
import { HomePage } from '../../pages/home/HomePage';
import { AppShell } from '../../widgets/app-shell';
import { NotFoundPage } from '../error/NotFoundPage';
import { RouteErrorPage } from '../error/RouteErrorPage';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'components',
        lazy: async () => ({
          Component: (await import('../../pages/components/ComponentsPage')).ComponentsPage,
        }),
      },
      {
        path: 'theme',
        lazy: async () => ({ Component: (await import('../../pages/theme/ThemePage')).ThemePage }),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
