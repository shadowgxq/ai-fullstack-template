import * as Popover from '@radix-ui/react-popover';
import { Languages, Moon, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '../../i18n';
import { useTheme } from '../../theme';
import styles from './SettingsMenu.module.css';

export type SettingsMenuProps = Record<string, never>;

export function SettingsMenu() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const { locale, setLocale, available } = useLocale();
  const isDark = mode === 'dark';

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          aria-label={t('header.settings')}
          title={t('header.settings')}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={styles.content}
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          aria-label={t('header.settings')}
        >
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>
              <Languages size={16} aria-hidden="true" />
              <span>{t('header.language')}</span>
            </span>
            <div className={styles.languageOptions} role="group" aria-label={t('header.language')}>
              {available.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={styles.languageButton}
                  data-active={locale === value}
                  aria-pressed={locale === value}
                  onClick={() => setLocale(value)}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.settingRow} ${styles.themeRow}`}>
            <span className={styles.settingLabel}>
              <Moon size={16} aria-hidden="true" />
              <span>{t('header.theme.label')}</span>
            </span>
            <button
              type="button"
              role="switch"
              className={styles.switch}
              data-checked={isDark}
              aria-checked={isDark}
              aria-label={t('header.theme.label')}
              onClick={() => setMode(isDark ? 'light' : 'dark')}
            >
              <span className={styles.switchThumb} />
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
