import { useState } from 'react';
import Taro from '@tarojs/taro';
import { useMutation } from '@tanstack/react-query';
import { api, type Credentials } from '../../shared/api/gateway';
import { saveAuthToken } from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { queryClient } from '../../shared/query/client';
import { validateCredentials } from '../../features/auth/validation';
import { PageShell, Card, Stack, Title, Body, Field, Button, Notice } from '../../shared/ui';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const login = useMutation({
    mutationFn: async (credentials: Credentials) => {
      const result = await api.login(credentials);
      saveAuthToken(result.access_token);
      return result;
    },
    onSuccess: () => {
      setPassword('');
      queryClient.clear();
      void Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/settings/index' }));
    },
  });
  const submit = () => {
    if (login.isPending) return;
    const issues = validateCredentials(username, password);
    setErrors(issues);
    if (!Object.keys(issues).length) login.mutate({ username, password });
  };
  return (
    <PageShell>
      <Stack>
        <Title>账户登录</Title>
        <Body secondary>使用已有用户名和密码登录。</Body>
      </Stack>
      <Card>
        <Stack>
          <Field
            id="username"
            label="用户名"
            value={username}
            onValueChange={setUsername}
            maxLength={50}
            error={errors.username}
            disabled={login.isPending}
          />
          <Field
            id="password"
            label="密码"
            value={password}
            onValueChange={setPassword}
            password
            maxLength={72}
            error={errors.password}
            disabled={login.isPending}
          />
          {login.isError ? <Notice tone="error">{errorMessage(login.error)}</Notice> : null}
          {!__API_BASE_URL__ ? <Notice>尚未配置后端地址。</Notice> : null}
          <Button loading={login.isPending} disabled={!__API_BASE_URL__} onClick={submit}>
            登录
          </Button>
        </Stack>
      </Card>
    </PageShell>
  );
}
