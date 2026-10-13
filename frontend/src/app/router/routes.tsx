import { Navigate, type RouteObject } from 'react-router-dom';

import { LoginPage } from '../../pages/login';
import { BookmarksPage } from '../../pages/bookmarks/BookmarksPage';
import { NotFoundPage } from '../error/NotFoundPage';
import { RouteErrorPage } from '../error/RouteErrorPage';

export const appRoutes: RouteObject[] = [
  {
    path: '/bookmarks',
    element: <BookmarksPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: <Navigate to="/bookmarks" replace />,
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
