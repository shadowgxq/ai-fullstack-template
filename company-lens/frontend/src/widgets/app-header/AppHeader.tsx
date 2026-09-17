import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { useAuthStore, useLoginModal, useLogout } from '../../features/auth';
import { ChevronLeft, History, Search } from '../../shared/icons';
import { AccountMenu } from '../../shared/ui/AccountMenu';
import { SettingsMenu } from '../../shared/ui/SettingsMenu';
import styles from './AppHeader.module.css';

const NAV_TABS = [
  { to: '/research', labelKey: 'header.tabs.research', end: false },
  { to: '/history', labelKey: 'header.tabs.history', end: false },
] as const;

export type MobileBack = {
  label: string;
  to: string;
};

export type AppHeaderProps = {
  mobileBack?: MobileBack;
};

export function AppHeader({ mobileBack }: AppHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const openLogin = useLoginModal((state) => state.openLogin);
  const logout = useLogout();
  const isHistoryPage = location.pathname === '/history';

  function handleLogout() {
    logout.mutate();
  }

  return (
    <header className={styles.root}>
      <div className={styles.mobileLeading}>
        {mobileBack ? (
          <Link
            className={styles.mobileIconButton}
            to={mobileBack.to}
            aria-label={mobileBack.label}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        ) : (
          <span className={styles.mobilePlaceholder} aria-hidden="true" />
        )}
      </div>

      <Link to="/" className={styles.brand} aria-label={t('header.homeLabel')}>
        <span className={styles.brandMark} aria-hidden="true">
          <Search size={16} />
        </span>
        <span className={styles.brandName}>{t('header.brand')}</span>
      </Link>

      <nav className={styles.tabs} aria-label={t('header.navLabel')}>
        {NAV_TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={styles.tab}>
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className={styles.actions}>
        {!isHistoryPage ? (
          <Link
            className={styles.historyLink}
            to="/history"
            aria-label={t('header.tabs.history')}
            title={t('header.tabs.history')}
          >
            <History size={20} aria-hidden="true" />
          </Link>
        ) : null}

        {user ? (
          <AccountMenu
            accountName={user.email || t('header.accountLabel')}
            onLogout={handleLogout}
            logoutPending={logout.isPending}
            changePasswordTo="/forgot-password"
          />
        ) : (
          <button type="button" className={styles.loginLink} onClick={() => openLogin()}>
            {t('header.login')}
          </button>
        )}

        <SettingsMenu />
      </div>
    </header>
  );
}
