import type { RouteObject } from 'react-router-dom';

import { HomePage } from '../../pages/home/HomePage';
import { NotFoundPage } from '../error/NotFoundPage';
import { RouteErrorPage } from '../error/RouteErrorPage';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
