import { useState, useSyncExternalStore } from 'react';
import Taro from '@tarojs/taro';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/gateway';
import { getAuthToken, clearAuthToken, subscribeAuthToken } from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { queryClient } from '../../shared/query/client';
import { useThemeStore, type ThemePreference } from '../../shared/theme/preferences';
import { PageShell, Card, Stack, Title, Body, Button, Notice } from '../../shared/ui';

const choices: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];
export default function PreferencesPage() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const storageWarning = useThemeStore((state) => state.storageWarning);
  const [themeError, setThemeError] = useState<string | null>(null);
  const token = useSyncExternalStore(subscribeAuthToken, getAuthToken, getAuthToken);
  const profile = useQuery({
    queryKey: ['session', 'me'],
    queryFn: ({ signal }) => api.me(signal),
    enabled: Boolean(token),
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      try {
        clearAuthToken();
      } catch {
        throw new Error('已退出，但未能清理本地凭据，请关闭小程序后重试');
      } finally {
        queryClient.clear();
      }
    },
  });
  return (
    <PageShell>
      <Card>
        <Stack>
          <Title section>外观</Title>
          {choices.map((choice) => (
            <Button
              key={choice.value}
              variant={preference === choice.value ? 'primary' : 'secondary'}
              onClick={() => {
                try {
                  setPreference(choice.value);
                  setThemeError(null);
                } catch {
                  setThemeError('无法保存外观设置，请重试');
                }
              }}
            >
              {choice.label}
              {preference === choice.value ? ' · 已选择' : ''}
            </Button>
          ))}
          {themeError || storageWarning ? (
            <Notice tone="error">{themeError || storageWarning}</Notice>
          ) : null}
        </Stack>
      </Card>
      <Card>
        <Stack>
          <Title section>账户</Title>
          {token && profile.data ? (
            <Body>{profile.data.username}</Body>
          ) : (
            <Body secondary>使用服务端账户登录。</Body>
          )}
          {profile.isError ? <Notice tone="error">{errorMessage(profile.error)}</Notice> : null}
          {logout.isError ? <Notice tone="error">{errorMessage(logout.error)}</Notice> : null}
          <Button
            variant="secondary"
            disabled={!__API_BASE_URL__}
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            账户登录
          </Button>
          {token ? (
            <Button variant="danger" loading={logout.isPending} onClick={() => logout.mutate()}>
              退出登录
            </Button>
          ) : null}
        </Stack>
      </Card>
      <Body secondary>版本 {__APP_VERSION__}</Body>
    </PageShell>
  );
}
