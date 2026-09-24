import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { GoogleLoginButton } from './GoogleLoginButton';

const mocks = vi.hoisted(() => ({
  runtimeConfig: {
    auth: {
      dataSource: 'api' as 'api' | 'mock',
      googleClientId: 'test-client-id' as string | undefined,
    },
  },
}));

vi.mock('../../../../shared/config', () => ({ runtimeConfig: mocks.runtimeConfig }));

function renderButton(onAuth = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <GoogleLoginButton onAuth={onAuth} />
    </I18nextProvider>,
  );
}

describe('GoogleLoginButton', () => {
  beforeEach(async () => {
    mocks.runtimeConfig.auth.googleClientId = 'test-client-id';
    delete window.google;
    await i18n.changeLanguage('zh');
  });

  afterEach(() => {
    delete window.google;
    vi.restoreAllMocks();
  });

  it('真实 client 使用自绘 outline 按钮，并通过授权码客户端发起登录', async () => {
    const requestCode = vi.fn();
    let config: GoogleCodeClientConfig | undefined;
    const initCodeClient = vi.fn((received: GoogleCodeClientConfig) => {
      config = received;
      return { requestCode };
    });
    window.google = { accounts: { oauth2: { initCodeClient } } };

    renderButton();

    const button = screen.getByRole('button', { name: '用 Google 继续' });
    expect(button).toHaveAttribute('data-variant', 'outline');
    expect(button).toHaveClass('w-full');
    expect(initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id', ux_mode: 'popup' }),
    );

    await userEvent.click(button);
    expect(requestCode).toHaveBeenCalledTimes(1);
    expect(config).toBeDefined();
  });

  it('授权码回调按 { code } 形态交给上层', () => {
    const onAuth = vi.fn();
    let config: GoogleCodeClientConfig | undefined;
    const initCodeClient = vi.fn((received: GoogleCodeClientConfig) => {
      config = received;
      return { requestCode: vi.fn() };
    });
    window.google = { accounts: { oauth2: { initCodeClient } } };

    renderButton(onAuth);

    act(() => {
      config?.callback({ code: 'auth-code-xyz' });
    });

    expect(onAuth).toHaveBeenCalledWith({ code: 'auth-code-xyz' });
  });

  it('未配置 client id 时保留 mock credential 链路', async () => {
    mocks.runtimeConfig.auth.googleClientId = undefined;
    const onAuth = vi.fn();

    renderButton(onAuth);
    await userEvent.click(screen.getByRole('button', { name: '用 Google 继续' }));

    expect(onAuth).toHaveBeenCalledWith({ credential: 'mock-google-credential' });
  });
});
