import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLocale } from '@/shared/i18n';
import { Settings } from '@/shared/icons';
import { useApplePageMotion } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export function AppShell() {
  const { t } = useTranslation();
  const { mode, setMode, preset, setPreset } = useTheme();
  const { locale, setLocale } = useLocale();
  const location = useLocation();
  const shellRef = useRef<HTMLDivElement>(null);
  useApplePageMotion(shellRef, location.pathname);
  return (
    <div ref={shellRef} className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        {t('nav.skip')}
      </a>
      <header className="border-b border-header-border bg-header">
        <div className="mx-auto flex min-h-[var(--header-height)] max-w-[var(--layout-max-width)] flex-wrap items-center gap-4 px-4 py-2 sm:px-8">
          <Link to="/" className="font-semibold tracking-tight">
            {t('app.title')}
          </Link>
          <nav aria-label={t('nav.label')} className="flex flex-1 gap-4 text-sm">
            <NavLink
              to="/components"
              className={({ isActive }) =>
                isActive
                  ? 'font-medium text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }
            >
              {t('nav.components')}
            </NavLink>
            <NavLink
              to="/theme"
              className={({ isActive }) =>
                isActive
                  ? 'font-medium text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }
            >
              {t('nav.theme')}
            </NavLink>
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('nav.settings')}>
                <Settings aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('theme.mode')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => {
                  if (value === 'light' || value === 'dark') setMode(value);
                }}
              >
                <DropdownMenuRadioItem value="light">{t('theme.light')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">{t('theme.dark')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('theme.preset')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={preset}
                onValueChange={(value) => {
                  if (value === 'signal' || value === 'neutral') setPreset(value);
                }}
              >
                <DropdownMenuRadioItem value="signal">{t('theme.signal')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="neutral">{t('theme.neutral')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('nav.language')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={locale}
                onValueChange={(value) => {
                  if (value === 'en' || value === 'zh') setLocale(value);
                }}
              >
                <DropdownMenuRadioItem value="en" lang="en">
                  English
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="zh" lang="zh-CN">
                  中文
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[var(--layout-max-width)] px-4 pt-[var(--page-padding-top)] pb-[var(--page-padding-bottom)] outline-none sm:px-8"
      >
        <Outlet />
      </main>
    </div>
  );
}
