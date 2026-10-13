import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n';
import { AuthForm } from './AuthForm';

vi.mock('../../model/auth.capabilities', () => ({
  authCapabilities: { emailCode: true, passwordReset: false, google: false, changePassword: false },
}));

it('keeps both login methods selectable when email-code login is enabled', async () => {
  await i18n.changeLanguage('en');
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthForm onAuthenticated={() => {}} />
      </QueryClientProvider>
    </I18nextProvider>,
  );

  expect(screen.getByRole('tab', { name: 'Email code' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Username & password' }));
  expect(screen.getByRole('tab', { name: 'Username & password' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByLabelText('Username')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Email code' }));
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});
