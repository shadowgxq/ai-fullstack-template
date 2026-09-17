import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useLoginModal } from '../../features/auth';
import { i18n } from '../../shared/i18n';
import { ForgotPasswordPage } from './ForgotPasswordPage';

const sendEmailCodeMock = vi.fn();
const resetPasswordMock = vi.fn();

vi.mock('../../features/auth/model/auth.mutations', () => ({
  useSendEmailCode: () => ({ mutate: sendEmailCodeMock, isPending: false, error: null }),
  useResetPassword: () => ({ mutate: resetPasswordMock, isPending: false, error: null }),
  // AppShell 顶栏会用到的其余 hooks
  useLogout: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useEmailCodeLogin: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  usePasswordLogin: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRegister: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useGoogleLogin: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/forgot-password']}>
          <ForgotPasswordPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** 让 mock 的 mutate 走 onSuccess，页面才会推进到下一步。 */
function succeedOnCall(mock: ReturnType<typeof vi.fn>) {
  mock.mockImplementation((_input: unknown, options?: { onSuccess?: (value?: unknown) => void }) => {
    options?.onSuccess?.();
  });
}

describe('ForgotPasswordPage', () => {
  beforeEach(async () => {
    sendEmailCodeMock.mockReset();
    resetPasswordMock.mockReset();
    useLoginModal.getState().closeLogin();
    // 本页会读登录态区分「找回密码」与「修改密码」，每例都从未登录起步。
    useAuthStore.setState({ token: null, user: null });
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('第一步用 RESET_PASSWORD 场景发送验证码并进入第二步', async () => {
    succeedOnCall(sendEmailCodeMock);
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'legacy@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(sendEmailCodeMock.mock.calls[0][0]).toEqual({
      email: 'legacy@example.com',
      scene: 'RESET_PASSWORD',
    });
    // 防枚举 + 脱敏：只说「如果已注册」，邮箱不整串回显
    expect(screen.getByText(/l\*\*\*y@example\.com/)).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });

  it('两次新密码不一致时就地报错，不发请求', async () => {
    succeedOnCall(sendEmailCodeMock);
    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'legacy@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('New password'), 'password-1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-2');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(resetPasswordMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("The two passwords don't match");
  });

  it('提交重置并在完成后引导去登录（拉起弹窗）', async () => {
    succeedOnCall(sendEmailCodeMock);
    succeedOnCall(resetPasswordMock);
    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'legacy@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('New password'), 'password-1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(resetPasswordMock.mock.calls[0][0]).toEqual({
      email: 'legacy@example.com',
      code: '123456',
      newPassword: 'password-1',
    });
    expect(screen.getByText('Password updated')).toBeInTheDocument();

    // 顶栏也有一个「Sign in」，完成态按钮用独立文案避免歧义
    await userEvent.click(screen.getByRole('button', { name: 'Go to sign in' }));
    expect(useLoginModal.getState().open).toBe(true);
  });

  it('登录态即「修改密码」：邮箱锁定为账号邮箱', async () => {
    useAuthStore.setState({ token: 'token-1', user: { userId: '1', email: 'owner@example.com' } });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toHaveValue('owner@example.com');
    // 只读：本页在登录态是「改我自己的密码」，不该能填成别人的邮箱
    expect(emailInput).toHaveAttribute('readonly');
  });

  it('登录态改完密码回首页，不拉登录弹窗（会话未失效）', async () => {
    useAuthStore.setState({ token: 'token-1', user: { userId: '1', email: 'owner@example.com' } });
    succeedOnCall(sendEmailCodeMock);
    succeedOnCall(resetPasswordMock);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('New password'), 'password-1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(sendEmailCodeMock.mock.calls[0][0]).toEqual({
      email: 'owner@example.com',
      scene: 'RESET_PASSWORD',
    });
    expect(resetPasswordMock.mock.calls[0][0]).toEqual({
      email: 'owner@example.com',
      code: '123456',
      newPassword: 'password-1',
    });

    expect(screen.queryByRole('button', { name: 'Go to sign in' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(useLoginModal.getState().open).toBe(false);
  });
});
