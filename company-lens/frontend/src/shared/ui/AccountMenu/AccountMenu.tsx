import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import styles from './AccountMenu.module.css';

const GENERATED_USERNAME_SUFFIX = /_[a-f0-9]{1,5}$/i;

function getDisplayAccountName(accountName: string) {
  const normalizedName = accountName.trim();
  const displayName = normalizedName.replace(GENERATED_USERNAME_SUFFIX, '');

  return displayName || normalizedName;
}

export type AccountMenuProps = {
  accountName: string;
  isAdmin?: boolean;
  onLogout: () => void;
  logoutPending?: boolean;
  changePasswordTo?: string;
  onChangePassword?: () => void;
  changePasswordEvent?: string;
  logoutEvent?: string;
};

export function AccountMenu({
  accountName,
  isAdmin = false,
  onLogout,
  logoutPending = false,
  changePasswordTo,
  onChangePassword,
  changePasswordEvent,
  logoutEvent,
}: AccountMenuProps) {
  const { t } = useTranslation();
  const accountMenuLabel = t('header.accountLabel');
  const displayName = getDisplayAccountName(accountName) || accountMenuLabel;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          aria-label={displayName}
          title={displayName}
        >
          <UserRound className={styles.triggerIcon} size={18} aria-hidden="true" />
          <span className={styles.triggerLabel}>{displayName}</span>
          <ChevronDown className={styles.triggerChevron} size={15} aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={styles.content}
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          aria-label={accountMenuLabel}
        >
          <div className={styles.summary}>
            <div className={styles.summaryMeta}>
              <span className={styles.summaryLabel}>{accountMenuLabel}</span>
              {isAdmin ? <span className={styles.roleBadge}>{t('header.adminRole')}</span> : null}
            </div>
            <span className={styles.summaryName} title={displayName}>
              {displayName}
            </span>
          </div>

          <div className={styles.actions}>
            {changePasswordTo ? (
              <Popover.Close asChild>
                <Link
                  className={styles.action}
                  to={changePasswordTo}
                  data-umami-event={changePasswordEvent}
                >
                  <KeyRound size={16} aria-hidden="true" />
                  <span>{t('auth.changePassword.entry')}</span>
                </Link>
              </Popover.Close>
            ) : null}

            {onChangePassword ? (
              <Popover.Close asChild>
                <button
                  type="button"
                  className={styles.action}
                  onClick={onChangePassword}
                  data-umami-event={changePasswordEvent}
                >
                  <KeyRound size={16} aria-hidden="true" />
                  <span>{t('auth.changePassword.entry')}</span>
                </button>
              </Popover.Close>
            ) : null}

            <span className={styles.separator} aria-hidden="true" />

            <Popover.Close asChild>
              <button
                type="button"
                className={`${styles.action} ${styles.logout}`}
                onClick={onLogout}
                disabled={logoutPending}
                data-umami-event={logoutEvent}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>{t('auth.logout')}</span>
              </button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
