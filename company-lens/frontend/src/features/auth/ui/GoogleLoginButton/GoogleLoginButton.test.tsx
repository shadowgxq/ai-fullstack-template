import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { GoogleLoginButton } from './GoogleLoginButton';

// 该用例验证未配置分支，不应被开发机的 .env.local 影响。
const mocks = vi.hoisted(() => ({
  runtimeConfig: {
    googleClientId: undefined as string | undefined,
    googleAuthMode: 'idtoken' as 'code' | 'idtoken',
  },
}));
vi.mock('../../../../shared/config', () => ({ runtimeConfig: mocks.runtimeConfig }));

describe('GoogleLoginButton', () => {
  beforeEach(async () => {
    mocks.runtimeConfig.googleClientId = undefined;
    mocks.runtimeConfig.googleAuthMode = 'idtoken';
    delete (window as { google?: unknown }).google;
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps the button visible and reports a missing client id without submitting a credential', async () => {
    const onAuth = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <GoogleLoginButton onAuth={onAuth} />
      </I18nextProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Google sign-in is not configured yet. Please use email sign-in.',
    );
    expect(onAuth).not.toHaveBeenCalled();
  });

  // 按钮文案由 GIS 在跨域 iframe 里自己渲染，本地 i18n 够不着：不显式传 locale 时
  // GIS 会读 Google 账号的语言偏好，导致英文界面里冒出「以某某的身份继续」。
  describe('GIS 按钮语言', () => {
    const stubGis = () => {
      const renderButton = vi.fn();
      const initialize = vi.fn();
      (window as { google?: unknown }).google = { accounts: { id: { initialize, renderButton } } };
      return { initialize, renderButton };
    };

    const renderButtonComponent = () =>
      render(
        <I18nextProvider i18n={i18n}>
          <GoogleLoginButton onAuth={vi.fn()} />
        </I18nextProvider>,
      );

    it('按当前应用语言渲染官方按钮（zh → zh_CN）', async () => {
      mocks.runtimeConfig.googleClientId = 'test-client-id';
      await i18n.changeLanguage('zh');
      const { renderButton } = stubGis();

      renderButtonComponent();

      expect(renderButton).toHaveBeenCalledTimes(1);
      expect(renderButton.mock.calls[0][1]).toMatchObject({ locale: 'zh_CN' });
    });

    it('英文界面渲染英文按钮（en → en）', async () => {
      mocks.runtimeConfig.googleClientId = 'test-client-id';
      const { renderButton } = stubGis();

      renderButtonComponent();

      expect(renderButton.mock.calls[0][1]).toMatchObject({ locale: 'en' });
    });

    it('切换语言后按新语言重渲，且先清空容器避免叠出两个按钮', async () => {
      mocks.runtimeConfig.googleClientId = 'test-client-id';
      await i18n.changeLanguage('zh');
      const { renderButton } = stubGis();

      renderButtonComponent();
      expect(renderButton).toHaveBeenCalledTimes(1);

      // 真实 GIS 会往容器里塞 iframe；这里手工塞一个，验证重渲前确实被清掉
      const slot = renderButton.mock.calls[0][0] as HTMLElement;
      slot.appendChild(document.createElement('iframe'));

      await act(async () => {
        await i18n.changeLanguage('en');
      });

      expect(renderButton).toHaveBeenCalledTimes(2);
      expect(renderButton.mock.calls[1][1]).toMatchObject({ locale: 'en' });
      expect(slot.childElementCount).toBe(0);
    });

    it('语言没变时不重复渲染', async () => {
      mocks.runtimeConfig.googleClientId = 'test-client-id';
      const { renderButton } = stubGis();

      const { rerender } = renderButtonComponent();
      rerender(
        <I18nextProvider i18n={i18n}>
          <GoogleLoginButton onAuth={vi.fn()} />
        </I18nextProvider>,
      );

      expect(renderButton).toHaveBeenCalledTimes(1);
    });

    it('上抛 ID token 形态的凭据', async () => {
      mocks.runtimeConfig.googleClientId = 'test-client-id';
      const { initialize } = stubGis();
      const onAuth = vi.fn();

      render(
        <I18nextProvider i18n={i18n}>
          <GoogleLoginButton onAuth={onAuth} />
        </I18nextProvider>,
      );

      act(() => {
        initialize.mock.calls[0][0].callback({ credential: 'id-token-abc' });
      });

      expect(onAuth).toHaveBeenCalledWith({ credential: 'id-token-abc' });
    });
  });

  // code 链路：GIS 只给 initCodeClient 这个 API 不给按钮，UI 是我方 DOM，
  // 因此按钮文案、配色、pending 态都能被本地 i18n 与设计令牌接管。
  describe('OAuth 授权码流', () => {
    const stubCodeClient = () => {
      const requestCode = vi.fn();
      const initCodeClient = vi.fn();
      initCodeClient.mockReturnValue({ requestCode });
      (window as { google?: unknown }).google = { accounts: { oauth2: { initCodeClient } } };
      return { initCodeClient, requestCode };
    };

    beforeEach(() => {
      mocks.runtimeConfig.googleClientId = 'test-client-id';
      mocks.runtimeConfig.googleAuthMode = 'code';
    });

    const renderCodeButton = (onAuth = vi.fn()) => {
      render(
        <I18nextProvider i18n={i18n}>
          <GoogleLoginButton onAuth={onAuth} />
        </I18nextProvider>,
      );
      return onAuth;
    };

    it('自绘按钮，点击时向 Google 索要授权码', async () => {
      const { initCodeClient, requestCode } = stubCodeClient();
      const user = userEvent.setup();
      renderCodeButton();

      expect(initCodeClient.mock.calls[0][0]).toMatchObject({
        client_id: 'test-client-id',
        ux_mode: 'popup',
      });

      await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

      expect(requestCode).toHaveBeenCalledTimes(1);
    });

    it('上抛 code 形态的凭据', () => {
      const { initCodeClient } = stubCodeClient();
      const onAuth = renderCodeButton();

      act(() => {
        initCodeClient.mock.calls[0][0].callback({ code: 'auth-code-abc' });
      });

      expect(onAuth).toHaveBeenCalledWith({ code: 'auth-code-abc' });
    });

    // 用户主动关掉授权窗时 Google 也会回调，这种不是故障，不该弹错误打扰。
    it('用户取消授权时既不上抛也不报错', () => {
      const { initCodeClient } = stubCodeClient();
      const onAuth = renderCodeButton();

      act(() => {
        initCodeClient.mock.calls[0][0].callback({ error: 'access_denied' });
      });

      expect(onAuth).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('授权失败时就地提示，不上抛空凭据', () => {
      const { initCodeClient } = stubCodeClient();
      const onAuth = renderCodeButton();

      act(() => {
        initCodeClient.mock.calls[0][0].callback({
          error: 'invalid_request',
          error_description: 'redirect_uri mismatch',
        });
      });

      expect(onAuth).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('redirect_uri mismatch');
    });
  });
});
