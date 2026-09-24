import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore, useLoginModal } from '../../features/auth';

/**
 * `/login` 不再是独立页面——登录改成了覆盖当前页的弹窗。
 * 这条路由保留下来只为兜住外部链接和旧书签：把人送回首页并顺手打开弹窗，
 * 而不是甩一个 404。已登录的直接回首页，不弹。
 */
export function LoginPage() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));
  const openLogin = useLoginModal((state) => state.openLogin);

  useEffect(() => {
    if (!isAuthenticated) {
      openLogin('login-route');
    }
  }, [isAuthenticated, openLogin]);

  return <Navigate to="/" replace />;
}
