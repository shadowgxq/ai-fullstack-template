import { useEffect } from 'react';

import { useAuthStore } from '../../features/auth';
import { startAnalytics, syncIdentity } from '../../shared/analytics';

/**
 * 埋点的启动与登录态同步。
 *
 * 放在 app 层是因为 shared/analytics 不能 import features/*（FSD 分层），由这里把
 * auth store 的 userId 喂进去。不渲染 DOM。
 */
export function AnalyticsProvider() {
  const userId = useAuthStore((state) => state.user?.userId ?? null);

  useEffect(() => {
    startAnalytics();
  }, []);

  useEffect(() => {
    syncIdentity(userId);
  }, [userId]);

  return null;
}
