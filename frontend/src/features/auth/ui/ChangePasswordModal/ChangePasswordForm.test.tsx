import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/shared/i18n';
import { useAuthStore } from '../../model/auth.store';
import type { AuthUser } from '../../model/auth.types';
import { ChangePasswordForm } from './ChangePasswordForm';

function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'u-1',
    username: 'alice',
    nickname: 'alice',
    email: 'alice@example.com',
    avatar: null,
    role: 'user',
    admin: false,
    ...overrides,
  };
}

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ChangePasswordForm />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('ChangePasswordForm', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useAuthStore.setState({ user: null });
  });

  it('未登录时不渲染表单', () => {
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('Log in before changing your password.');
    expect(screen.queryByLabelText('Account email')).not.toBeInTheDocument();
  });

  it('账号未绑定邮箱时说明原因而不是给一个发不出去的按钮', () => {
    useAuthStore.setState({ user: mockUser({ email: null }) });

    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('This account has no email bound');
    expect(screen.queryByRole('button', { name: 'Send code' })).not.toBeInTheDocument();
  });

  it('账号邮箱预填且只读，不允许改成别人的邮箱', () => {
    useAuthStore.setState({ user: mockUser() });

    renderForm();

    const emailInput = screen.getByLabelText('Account email');
    expect(emailInput).toHaveValue('alice@example.com');
    expect(emailInput).toHaveAttribute('readonly');
  });

  it('字段未填满时提交按钮保持禁用，不让发出必然失败的请求', async () => {
    useAuthStore.setState({ user: mockUser() });

    renderForm();

    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('New password'), 'Passw0rd123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Passw0rd123');

    expect(screen.getByRole('button', { name: 'Change password' })).toBeEnabled();
  });

  it('验证码格式不合法时挡下提交，并把错误挂到验证码字段', async () => {
    useAuthStore.setState({ user: mockUser() });

    renderForm();

    await userEvent.type(screen.getByLabelText('Verification code'), '12');
    await userEvent.type(screen.getByLabelText('New password'), 'Passw0rd123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Passw0rd123');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    const codeInput = screen.getByLabelText('Verification code');
    expect(codeInput).toHaveAttribute('aria-invalid', 'true');
    expect(codeInput).toHaveAttribute('aria-describedby', 'change-password-code-error');
  });

  it('两次密码不一致时错误挂到确认字段', async () => {
    useAuthStore.setState({ user: mockUser() });

    renderForm();

    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('New password'), 'Passw0rd123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Passw0rd999');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  });
});
