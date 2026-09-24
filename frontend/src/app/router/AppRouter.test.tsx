import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../shared/i18n';
import { RouteErrorPage } from '../error/RouteErrorPage';
import { appRoutes } from './routes';

function BrokenRoute(): never {
  throw new Error('route render failed');
}

function renderRouter(router: ReturnType<typeof createMemoryRouter>) {
  const queryClient = new QueryClient();

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
  });

  it.each([
    ['/', 'Build a shippable frontend baseline for agents.'],
    ['/foundation', 'Start from stable shared capabilities.'],
  ])('renders the home view at %s', (path, heading) => {
    const router = createMemoryRouter(appRoutes, { initialEntries: [path] });

    renderRouter(router);

    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('renders the not-found page for an unknown path', () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/missing'] });

    renderRouter(router);

    expect(screen.getByRole('heading', { name: 'This page does not exist.' })).toBeInTheDocument();
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
