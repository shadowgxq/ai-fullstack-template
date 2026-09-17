import { Navigate, type RouteObject } from 'react-router-dom';

import { ForgotPasswordPage } from '../../pages/forgot-password';
import { TermsPage } from '../../pages/terms';
import { HistoryPage } from '../../pages/history/HistoryPage';
import { HomePage } from '../../pages/home/HomePage';
import { LoginPage } from '../../pages/login/LoginPage';
import { AgentReportPage } from '../../pages/agent-report';
import { CompanyDetailPage } from '../../pages/company-detail';
import { ResearchPage } from '../../pages/research/ResearchPage';
import { ResearchProgressPage } from '../../pages/research-progress';
import { ResearchResultPage } from '../../pages/research-result';
import { NotFoundPage } from '../error/NotFoundPage';
import { RouteErrorPage } from '../error/RouteErrorPage';
import { RootLayout } from './RootLayout';

const pageRoutes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/research',
    element: <Navigate to="/research/new" replace />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/research/new',
    element: <ResearchPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/research/:projectId/progress',
    element: <ResearchProgressPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/research/:projectId/result',
    element: <ResearchResultPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/research/:projectId/agents/:agentId/report',
    element: <AgentReportPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/research/:projectId/companies/:companyId',
    element: <CompanyDetailPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/history',
    element: <HistoryPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/terms',
    element: <TermsPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: pageRoutes,
  },
];
