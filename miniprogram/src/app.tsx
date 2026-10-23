import './shared/platform/polyfills';
import { useEffect, useState, type PropsWithChildren } from 'react';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { queryClient } from './shared/query/client';
import { bindNetworkStatus } from './shared/query/lifecycle';
import { useThemeStore } from './shared/theme/preferences';
import { hydrateAuthToken, setUnauthorizedHandler } from './shared/api/auth-token';
import { redirectToLogin } from './features/auth/navigation';
import './app.scss';

export default function App({ children }: PropsWithChildren) {
  useState(() => {
    try {
      hydrateAuthToken();
    } catch {
      /* 在页面首次读取会话前完成恢复；存储失败时交给登录页重新登录。 */
    }
    return true;
  });
  useDidShow(() => {
    try {
      hydrateAuthToken();
    } catch {
      /* 存储不可读时不伪造新的会话。 */
    }
    focusManager.setFocused(true);
    useThemeStore.getState().hydrate();
    if (Taro.getCurrentPages().length) void redirectToLogin();
  });
  useDidHide(() => focusManager.setFocused(false));
  useEffect(() => {
    useThemeStore.getState().hydrate();
    try {
      hydrateAuthToken();
    } catch {
      /* 存储不可读时保持未登录，不伪造登录态。 */
    }
    setUnauthorizedHandler(() => {
      queryClient.clear();
      void redirectToLogin();
    });
    const unbindNetwork = bindNetworkStatus();
    const onTheme = ({ theme }: { theme: 'light' | 'dark' }) =>
      useThemeStore.getState().setSystemTheme(theme);
    Taro.onThemeChange(onTheme);
    return () => {
      unbindNetwork();
      Taro.offThemeChange(onTheme);
      setUnauthorizedHandler(null);
    };
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
