import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { useAuthStore } from '../../model/auth.store';
import { useLoginModal } from '../../model/login-modal.store';
import { LoginModal } from './LoginModal';

// 隔离 GIS 脚本加载：本用例只验证弹窗开关与续做动作的交接。
vi.mock('../GoogleLoginButton', () => ({
  GoogleLoginButton: () => <div data-testid="google-login-button" />,
}));

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // AuthForm 里有「忘记密码」的 <Link>，弹窗子树需要 Router context（生产由无路径布局路由提供）。
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginModal />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('LoginModal', () => {
  beforeEach(async () => {
    useAuthStore.getState().clear();
    useLoginModal.getState().closeLogin();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('默认不渲染，openLogin 后出现登录表单', () => {
    renderModal();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();

    act(() => {
      useLoginModal.getState().openLogin();
    });

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('登录成功后执行续做动作并关闭弹窗', async () => {
    const pending = vi.fn();
    renderModal();

    act(() => {
      useLoginModal.getState().openLogin(pending);
    });

    await userEvent.type(screen.getByLabelText('Email'), 'demo@example.com');
    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in / Sign up' }));

    await vi.waitFor(() => {
      expect(pending).toHaveBeenCalledTimes(1);
    });
    expect(useLoginModal.getState().open).toBe(false);
  });

  // 否则用户在结果页点了「保存」又把弹窗关掉，之后从顶栏登录会莫名触发那次保存。
  it('关闭弹窗时丢弃续做动作', () => {
    const pending = vi.fn();
    renderModal();

    act(() => {
      useLoginModal.getState().openLogin(pending);
    });
    act(() => {
      useLoginModal.getState().setOpen(false);
    });

    expect(useLoginModal.getState().pendingAction).toBeNull();
    expect(pending).not.toHaveBeenCalled();
  });

  it('点关闭按钮收起弹窗', async () => {
    renderModal();

    act(() => {
      useLoginModal.getState().openLogin();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Close sign-in' }));

    expect(useLoginModal.getState().open).toBe(false);
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  // openLogin 常被挂到 onClick 上，写成 onClick={openLogin} 会把鼠标事件传进来。
  it('传入非函数时不把它当作续做动作', () => {
    renderModal();

    act(() => {
      (useLoginModal.getState().openLogin as (value: unknown) => void)({ type: 'click' });
    });

    expect(useLoginModal.getState().pendingAction).toBeNull();
  });
});
