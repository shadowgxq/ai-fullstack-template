import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import {
  clearAuthToken,
  notifyUnauthorized,
  saveAuthSession,
  getAuthSession,
  setUnauthorizedHandler,
} from '../src/shared/api/auth-token';
import { redirectToLogin } from '../src/features/auth/navigation';

beforeEach(() => {
  vi.resetAllMocks();
  Taro.getCurrentPages.mockReturnValue([{ route: 'pages/wardrobe/index' }]);
  Taro.reLaunch.mockResolvedValue({});
  Taro.showToast.mockResolvedValue({});
  setUnauthorizedHandler(null);
  clearAuthToken();
});

describe('signed-out navigation', () => {
  it('replaces the private page stack on first entry and after logout', async () => {
    await redirectToLogin();
    expect(Taro.reLaunch).toHaveBeenCalledExactlyOnceWith({ url: '/pages/login/index' });
    Taro.reLaunch.mockClear();
    saveAuthSession('owner', 1);
    await redirectToLogin();
    expect(Taro.reLaunch).not.toHaveBeenCalled();
    clearAuthToken();
    await redirectToLogin();
    expect(Taro.reLaunch).toHaveBeenCalledExactlyOnceWith({ url: '/pages/login/index' });
  });

  it('does not redirect the login page or create concurrent navigation', async () => {
    Taro.getCurrentPages.mockReturnValue([{ route: '/pages/login/index' }]);
    await redirectToLogin();
    expect(Taro.reLaunch).not.toHaveBeenCalled();
    Taro.getCurrentPages.mockReturnValue([{ route: 'pages/wear-detail/index' }]);
    let finish!: (value: object) => void;
    Taro.reLaunch.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = redirectToLogin();
    expect(redirectToLogin()).toBe(first);
    expect(Taro.reLaunch).toHaveBeenCalledOnce();
    finish({});
    await first;
  });

  it('redirects only a matching unauthorized session and preserves a newer login', async () => {
    saveAuthSession('old-owner', 1);
    const old = getAuthSession();
    saveAuthSession('current-owner', 2);
    const handler = vi.fn(() => {
      void redirectToLogin();
    });
    setUnauthorizedHandler(handler);
    notifyUnauthorized(old);
    expect(handler).not.toHaveBeenCalled();
    expect(Taro.reLaunch).not.toHaveBeenCalled();
    notifyUnauthorized(getAuthSession());
    await redirectToLogin();
    expect(getAuthSession()).toBeNull();
    expect(Taro.reLaunch).toHaveBeenCalledExactlyOnceWith({ url: '/pages/login/index' });
    setUnauthorizedHandler(null);
  });

  it('releases a failed redirect so foreground entry can retry', async () => {
    Taro.reLaunch.mockRejectedValueOnce(new Error('host unavailable'));
    await redirectToLogin();
    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '登录页暂时无法打开，请重新进入',
      icon: 'none',
    });
    await redirectToLogin();
    expect(Taro.reLaunch).toHaveBeenCalledTimes(2);
  });
});
