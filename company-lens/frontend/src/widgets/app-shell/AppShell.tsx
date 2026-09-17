import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader, type MobileBack } from '../app-header';
import styles from './AppShell.module.css';

export type AppShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  mobileBack?: MobileBack;
};

export function AppShell({ children, className, contentClassName, mobileBack }: AppShellProps) {
  const { t } = useTranslation();

  return (
    <div className={clsx(styles.root, className)}>
      <a className={styles.skipLink} href="#main-content">
        {t('header.skipToContent')}
      </a>
      <AppHeader mobileBack={mobileBack} />
      <div id="main-content" className={clsx(styles.content, contentClassName)} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
