import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore, useLoginModal } from '../../features/auth';
import { i18n, useLocaleStore } from '../../shared/i18n';
import { useThemeStore } from '../../shared/theme';
import { AppHeader } from './AppHeader';

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/research']}>
        <QueryClientProvider client={queryClient}>
          <AppHeader />
        </QueryClientProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('AppHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useAuthStore.setState({ token: null, user: null });
    useLoginModal.getState().closeLogin();
    useLocaleStore.setState({ locale: 'en' });
    useThemeStore.setState({ mode: 'light' });
    document.documentElement.dataset.theme = 'light';
  });

  afterEach(() => {
    cleanup();
  });

  it('opens a compact settings menu with language and theme controls', async () => {
    const user = userEvent.setup();
    renderHeader();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const menu = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(menu).getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(within(menu).getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await user.click(within(menu).getByRole('switch', { name: 'Dark mode' }));
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('opens the sign-in modal from the guest action', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(useLoginModal.getState().open).toBe(true);
    expect(useLoginModal.getState().pendingAction).toBeNull();
  });

  it('shows the signed-in identity and groups account actions in its menu', async () => {
    useAuthStore.setState({ token: 'token-1', user: { userId: '1', email: 'owner@example.com' } });
    const user = userEvent.setup();
    renderHeader();

    expect(screen.getByRole('button', { name: 'owner@example.com' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Change password' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'owner@example.com' }));
    const menu = screen.getByRole('dialog', { name: 'Account' });
    expect(within(menu).getByText('Account')).toBeInTheDocument();
    expect(within(menu).getByText('owner@example.com')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(within(menu).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('does not render account actions before sign-in', async () => {
    const user = userEvent.setup();
    renderHeader();

    expect(screen.queryByRole('button', { name: 'owner@example.com' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const menu = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(menu).queryByRole('link', { name: 'Change password' })).not.toBeInTheDocument();
  });
});
