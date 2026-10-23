import { useState, useSyncExternalStore } from 'react';
import Taro from '@tarojs/taro';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/gateway';
import { getAuthSession, subscribeAuthToken } from '../../shared/api/auth-token';
import { logoutCurrentSession } from '../../features/auth/session';
import { errorMessage } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';
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
  const session = useSyncExternalStore(subscribeAuthToken, getAuthSession, getAuthSession);
  const [logoutWarning, setLogoutWarning] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: sessionQueryKey(session, 'profile'),
    queryFn: ({ signal }) => api.profile(signal),
    enabled: Boolean(session),
  });
  const logout = useMutation({
    mutationFn: logoutCurrentSession,
    onSuccess: setLogoutWarning,
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
          {session && profile.data ? (
            <Body>{profile.data.nickname || '衣柜用户'}</Body>
          ) : (
            <Body secondary>微信登录后查看个人资料。</Body>
          )}
          {profile.isError ? <Notice tone="error">{errorMessage(profile.error)}</Notice> : null}
          {logout.isError ? <Notice tone="error">{errorMessage(logout.error)}</Notice> : null}
          {logoutWarning ? <Notice tone="error">{logoutWarning}</Notice> : null}
          <Button
            variant="secondary"
            disabled={!__API_BASE_URL__}
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            微信登录
          </Button>
          {session ? (
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
