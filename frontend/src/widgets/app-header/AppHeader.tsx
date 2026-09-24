import { House, Layers3, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useAuthStore, useLoginModal, useLogout } from '../../features/auth';
import { AccountMenu } from './AccountMenu';
import { SettingsMenu } from './SettingsMenu';

const NAV_TABS = [
  { to: '/', labelKey: 'header.tabs.overview', Icon: House },
  { to: '/components', labelKey: 'header.tabs.components', Icon: LayoutGrid },
  { to: '/theme', labelKey: 'header.tabs.theme', Icon: Layers3 },
] as const;

export function AppHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const openLogin = useLoginModal((state) => state.openLogin);
  const logout = useLogout();

  const accountName = user?.username || user?.nickname || user?.email || t('header.accountLabel');

  return (
    // z-40 必须低于 shadcn 浮层的 z-50：dropdown、dialog、popover、tooltip 全部用 z-50，
    // header 若高于它们，浮层会被压在顶栏下面，登录弹窗的遮罩也盖不住顶栏。
    <header className="border-header-border bg-header sticky top-0 z-40 grid h-[60px] min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-0 border-b px-[max(1.5rem,calc((100%-var(--layout-max-width))/2))] max-[760px]:flex max-[760px]:h-auto max-[760px]:min-h-[60px] max-[760px]:gap-2 max-[760px]:px-3 max-[760px]:py-2">
      <Link
        to="/"
        className="text-foreground group inline-flex min-w-0 items-center gap-2 justify-self-start rounded-md font-bold no-underline"
        aria-label={t('header.homeLabel')}
        onClick={(event) => {
          if (location.pathname === '/') {
            event.preventDefault();
            window.location.reload();
          }
        }}
      >
        <span
          className="text-primary group-hover:text-primary/80 inline-grid size-6 flex-none place-items-center transition-colors max-[760px]:size-[22px] motion-reduce:transition-none"
          aria-hidden="true"
        >
          <svg
            className="size-6 max-[760px]:size-[22px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <path d="M14 3h7v7h-7z" />
            <path d="M14 14h7v7h-7z" />
            <path d="M3 14h7v7H3z" />
            <path d="M10 10h4v4h-4z" />
          </svg>
        </span>
        <span className="truncate text-base font-semibold max-[760px]:hidden">
          {t('app.title')}
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-8 justify-self-end max-[760px]:ml-auto max-[760px]:gap-1">
        <nav
          className="inline-flex items-center gap-6 max-[760px]:min-w-0 max-[760px]:gap-1"
          aria-label={t('header.navLabel')}
        >
          {NAV_TABS.map(({ to, labelKey, Icon }) => {
            const isActive =
              location.pathname === to || (to !== '/' && location.pathname.startsWith(`${to}/`));
            return (
              <Link
                key={to}
                to={to}
                className="text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:text-primary relative inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-0 text-[15px] leading-none font-medium no-underline transition-colors data-[active=true]:font-semibold after:absolute after:right-1/2 after:bottom-0 after:hidden after:h-0.5 after:w-[22px] after:translate-x-1/2 after:rounded-full after:bg-current after:content-[''] data-[active=true]:after:block max-[760px]:min-h-10 max-[760px]:min-w-0 max-[760px]:px-2 max-[760px]:text-sm max-[760px]:after:-bottom-2 max-[420px]:gap-1 max-[420px]:px-[5px] max-[420px]:text-xs max-[360px]:w-10 max-[360px]:px-0 motion-reduce:transition-none"
                data-active={isActive}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="flex-none" size={18} aria-hidden="true" />
                <span className="relative inline-block max-[360px]:hidden">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex min-h-8 min-w-0 items-center gap-4 max-[760px]:gap-1">
          <SettingsMenu />
          {user ? (
            <AccountMenu
              accountName={accountName}
              isAdmin={user.admin}
              onLogout={() => logout.mutate()}
              logoutPending={logout.isPending}
            />
          ) : (
            <button
              type="button"
              className="border-primary/70 text-primary hover:border-primary hover:bg-primary/10 focus-visible:ring-ring inline-flex h-9 min-h-9 items-center justify-center rounded-md border bg-transparent px-3.5 text-[15px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none max-[420px]:px-2 max-[420px]:text-xs motion-reduce:transition-none"
              onClick={() => openLogin('header')}
            >
              {t('header.login')}
            </button>
          )}
        </div>
      </div>
      {logout.isError ? <p role="alert" className="text-destructive text-sm">{t('auth.errors.generic')}</p> : null}
    </header>
  );
}
