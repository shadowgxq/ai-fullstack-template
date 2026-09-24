import type { RouteObject } from 'react-router-dom';

import { LoginPage } from '../../pages/login';
import { ComponentsPage } from '../../pages/components/ComponentsPage';
import { ComponentDetailPage } from '../../pages/components/ComponentDetailPage';
import { HomePage } from '../../pages/home/HomePage';
import { ThemePage } from '../../pages/theme/ThemePage';
import { NotFoundPage } from '../error/NotFoundPage';
import { RouteErrorPage } from '../error/RouteErrorPage';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/foundation',
    element: <HomePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/theme',
    element: <ThemePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/components',
    element: <ComponentsPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/components/:componentName',
    element: <ComponentDetailPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
