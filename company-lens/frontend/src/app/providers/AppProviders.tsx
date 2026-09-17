import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '../../shared/i18n';
import { DocumentTitleSync } from './DocumentTitleSync';
import { ThemeInitializer } from './ThemeInitializer';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeInitializer />
        <DocumentTitleSync />
        {/* 登录弹窗不在这里：AuthForm 需要 Router context（忘记密码的 <Link>），
            已移到 routes.tsx 的无路径布局路由，覆盖面（含 404）不变。 */}
        {children}
      </QueryClientProvider>
    </I18nextProvider>
  );
}
