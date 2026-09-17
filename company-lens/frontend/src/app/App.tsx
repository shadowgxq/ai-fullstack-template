import { useEffect } from 'react';

import { revalidateSession } from '../features/auth';
// 暂停访问统计：后端 `/v1/analytics/visit` 当前返回 404，接口恢复后再启用。
// import { trackVisit } from '../shared/analytics';
import { GlobalErrorBoundary } from './error/GlobalErrorBoundary';
import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/AppRouter';

export function App() {
  useEffect(() => {
    // trackVisit();
    // 带着本地缓存的会话启动时，回源校验并刷新用户信息（无 token / mock 数据源自动跳过）。
    void revalidateSession();
  }, []);

  return (
    <GlobalErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </GlobalErrorBoundary>
  );
}
