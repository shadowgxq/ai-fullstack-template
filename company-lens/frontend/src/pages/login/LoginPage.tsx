import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { useAuthStore, useLoginModal } from '../../features/auth';

const DEFAULT_DESTINATION = '/';

/**
 * 只接受站内相对路径，防开放重定向：
 * 必须以单个 `/` 开头，`//host` 这类协议相对地址一律回落到默认目的地。
 */
function safeDestination(returnTo: string | null): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }
  return returnTo;
}

/**
 * `/login` 不再是独立页面——登录改成了覆盖当前页的弹窗。
 * 这条路由保留下来只为兜住外部链接和旧书签：把人送到目的地并顺手打开弹窗，
 * 而不是甩一个 404。已登录的直接过去，不弹。
 *
 * `returnTo` 继续认，是为了兼容既有的外部链接；本次改造后应用内部不再生成
 * 带 returnTo 的登录链接。
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));
  const openLogin = useLoginModal((state) => state.openLogin);
  const destination = safeDestination(searchParams.get('returnTo'));

  useEffect(() => {
    if (!isAuthenticated) {
      openLogin();
    }
  }, [isAuthenticated, openLogin]);

  return <Navigate to={destination} replace />;
}
