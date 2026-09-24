import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n';
import { useAuthStore } from '../../model/auth.store';
import { AuthForm } from './AuthForm';
const { passwordLogin, register } = vi.hoisted(() => ({ passwordLogin: vi.fn(), register: vi.fn() }));
vi.mock('../../model/auth.source', () => ({ authGateway: { passwordLogin, register } }));
function mount() {
  return render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <AuthForm onAuthenticated={() => {}} />
  </QueryClientProvider></I18nextProvider>);
}
describe('standard form with fullstack capabilities', () => {
  beforeEach(async () => { vi.clearAllMocks(); useAuthStore.getState().clear(); await i18n.changeLanguage('en'); });
  it('starts with username/password and hides unsupported remote flows', () => {
    mount();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument();
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
  });
  it('submits actual username/password and keeps input when backend fails', async () => {
    passwordLogin.mockRejectedValue(new Error('unavailable'));
    mount();
    await userEvent.type(screen.getByLabelText('Username'), 'alice_9f2c');
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Passw0rd!');
    fireEvent.submit(screen.getByLabelText('Username').closest('form')!);
    await waitFor(() => expect(passwordLogin).toHaveBeenCalledWith({ username: 'alice_9f2c', password: 'Passw0rd!' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('alice_9f2c');
  });
});
