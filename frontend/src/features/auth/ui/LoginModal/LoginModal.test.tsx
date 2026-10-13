import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n';
import { useLoginModal } from '../../model/login-modal.store';
import { LoginModal } from './LoginModal';

afterEach(() => useLoginModal.getState().closeLogin());

it('shows a visible login title without a redundant single-method selector', async () => {
  await i18n.changeLanguage('en');
  useLoginModal.getState().openLogin();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <LoginModal />
      </QueryClientProvider>
    </I18nextProvider>,
  );

  expect(screen.getByRole('dialog', { name: 'Log in' })).toBeInTheDocument();
  const title = screen.getByRole('heading', { name: 'Log in' });
  expect(title.parentElement).not.toHaveClass('sr-only');
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Username')).toBeInTheDocument();
});
