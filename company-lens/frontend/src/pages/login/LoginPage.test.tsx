import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore, useLoginModal } from '../../features/auth';
import { i18n } from '../../shared/i18n';
import { LoginPage } from './LoginPage';

/**
 * `/login` 已不是独立页面，只是兜住外部链接与旧书签的重定向 shim：
 * 把人送到目的地，未登录时顺手打开登录弹窗。
 */
function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home landing</div>} />
          <Route path="/history" element={<div>History landing</div>} />
          <Route path="/research" element={<div>Research landing</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('LoginPage 兜底重定向', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    useLoginModal.getState().closeLogin();
  });

  afterEach(() => {
    cleanup();
  });

  it('未登录时回首页并打开登录弹窗', () => {
    renderAt('/login');

    expect(screen.getByText('Home landing')).toBeInTheDocument();
    expect(useLoginModal.getState().open).toBe(true);
  });

  it('带 returnTo 时送到该地址，弹窗照开', () => {
    renderAt('/login?returnTo=%2Fresearch');

    expect(screen.getByText('Research landing')).toBeInTheDocument();
    expect(useLoginModal.getState().open).toBe(true);
  });

  it('returnTo 是站外地址时回落到首页，不做开放重定向', () => {
    renderAt('/login?returnTo=https%3A%2F%2Fevil.example.com');

    expect(screen.getByText('Home landing')).toBeInTheDocument();
  });

  it('已登录时直接过去，不弹窗', () => {
    useAuthStore.getState().setSession('jwt', { userId: '1', email: 'a@example.com' });
    renderAt('/login?returnTo=%2Fhistory');

    expect(screen.getByText('History landing')).toBeInTheDocument();
    expect(useLoginModal.getState().open).toBe(false);
  });
});
