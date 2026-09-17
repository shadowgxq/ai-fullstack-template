import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetResearchComposition,
  setResearchRepositoryForTest,
} from '../../entities/research/api/research.composition';
import { createMockResearchRepository } from '../../entities/research/api/mock/mock-research.repository';
import { useAuthStore } from '../../features/auth';
import { i18n } from '../../shared/i18n';
import { RouteErrorPage } from '../error/RouteErrorPage';
import { appRoutes } from './routes';

function BrokenRoute(): never {
  throw new Error('route render failed');
}

function renderRouter(router: ReturnType<typeof createMemoryRouter>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('AppRouter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    setResearchRepositoryForTest(createMockResearchRepository());
    useAuthStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    resetResearchComposition();
    useAuthStore.getState().clear();
  });

  it('renders the not-found page for an unknown path', () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/missing'] });

    renderRouter(router);

    expect(screen.getByRole('heading', { name: 'This page does not exist.' })).toBeInTheDocument();
  });

  it('does not expose the removed public share token route', () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/share/public-token'] });

    renderRouter(router);

    expect(screen.getByRole('heading', { name: 'This page does not exist.' })).toBeInTheDocument();
  });

  it('keeps the home page intact and points both research CTAs to the canonical route', () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] });

    renderRouter(router);

    expect(screen.getByRole('heading', { name: /Understand a great company/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Start for free' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Start for free' })[0]).toHaveAttribute(
      'href',
      '/research/new',
    );
  });

  it('renders ResearchPage at the canonical input route', () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/research/new'] });

    renderRouter(router);

    expect(
      screen.getByRole('heading', {
        name: 'Enter one research target. Get a complete company report.',
      }),
    ).toBeInTheDocument();
  });

  it('replace-redirects the legacy research route to the canonical route', async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/research'] });

    renderRouter(router);

    await screen.findByRole('heading', {
      name: 'Enter one research target. Get a complete company report.',
    });
    expect(router.state.location.pathname).toBe('/research/new');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('previews anonymous history and offers sign-in for the full list', async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/history'] });

    renderRouter(router);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to unlock your full history' }),
    ).toBeInTheDocument();
    // 登录改成了就地弹窗，这个入口不再是跳 /login 的链接
    expect(
      screen.getByRole('button', { name: 'Sign in to view all history' }),
    ).toBeInTheDocument();
  });

  it('links a signed-in user’s history records to the result route', async () => {
    useAuthStore.getState().setSession('test-token', { userId: 'u-1', email: 'demo@example.com' });
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/history'] });

    renderRouter(router);

    const item = await screen.findByRole('link', { name: 'View the report for NVIDIA' });
    expect(item).toHaveAttribute('href', '/research/mock-history-0002/result');
    expect(screen.getByRole('link', { name: 'Back to new research' })).toHaveAttribute(
      'href',
      '/research/new',
    );
  });

  it('renders the route error page when a route fails to render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <BrokenRoute />,
          errorElement: <RouteErrorPage />,
        },
      ],
      { initialEntries: ['/'] },
    );

    renderRouter(router);

    expect(
      screen.getByRole('heading', { name: 'This page could not be displayed.' }),
    ).toBeInTheDocument();
  });
});
