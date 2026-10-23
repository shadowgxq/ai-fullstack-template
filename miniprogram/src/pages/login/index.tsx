import { useEffect, useRef, useState } from 'react';
import { useDidHide } from '@tarojs/taro';
import { Notice } from '../../shared/ui';
import { loginWithWeChat } from '../../features/auth/session';
import { WardrobePage, openWardrobe } from '../../features/wardrobe/Page';
import { errorMessage } from '../../shared/api/errors';
import { WardrobeEmptyState } from '../../features/wardrobe/EmptyState';

export default function LoginPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setPending(false);
  };
  useDidHide(cancel);
  useEffect(() => cancel, []);
  const submit = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      await loginWithWeChat(controller.signal);
      if (!controller.signal.aborted) await openWardrobe();
    } catch (issue) {
      if (!controller.signal.aborted) setError(errorMessage(issue));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  };
  return (
    <WardrobePage title="我的" publicPage account>
      <WardrobeEmptyState
        kind="login"
        loading={pending}
        disabled={!__API_BASE_URL__}
        actionLabel={pending ? '登录中' : '微信登录'}
        onAction={() => {
          void submit();
        }}
        feedback={
          <>
            {error ? <Notice tone="error">{error}</Notice> : null}
            {!__API_BASE_URL__ ? <Notice>尚未配置后端服务地址。</Notice> : null}
          </>
        }
        note="无需设置密码，头像和昵称可稍后完善"
      />
    </WardrobePage>
  );
}
