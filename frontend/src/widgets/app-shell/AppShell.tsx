import { useRef, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { ChangePasswordModal, LoginModal } from '../../features/auth';
import { useApplePageMotion } from '../../shared/motion';
import { AppHeader } from '../app-header';
import { AppFooter } from './AppFooter';

type AppShellProps = PropsWithChildren<{
  hideFooter?: boolean;
}>;

export function AppShell({ children, hideFooter = false }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const shellRef = useRef<HTMLDivElement>(null);
  const showFooter =
    !hideFooter &&
    !['/foundation', '/theme'].includes(location.pathname) &&
    !location.pathname.startsWith('/components');

  useApplePageMotion(shellRef, location.pathname);

  return (
    <div ref={shellRef} className="bg-background text-foreground flex min-h-dvh flex-col">
      {/* 跳转到主内容的链接：平时移出视口，键盘聚焦时才落回来。 */}
      <a
        className="bg-foreground text-background fixed top-2 left-2 z-50 -translate-y-[calc(100%+0.75rem)] rounded-md px-3 py-2 no-underline focus:translate-y-0"
        href="#main-content"
      >
        {t('header.skipToContent')}
      </a>
      <AppHeader />
      <div className={showFooter ? 'min-h-0 min-w-0 flex-1 pb-14' : 'min-h-0 min-w-0 flex-1'}>
        {children}
      </div>
      {showFooter ? <AppFooter /> : null}
      <LoginModal />
      <ChangePasswordModal />
    </div>
  );
}
