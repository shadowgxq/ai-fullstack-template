import { Languages, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '../../../shared/i18n';
import { useTheme, type ThemeMode } from '../../../shared/theme';
import styles from './DemoControls.module.css';

const THEME_OPTIONS: { mode: ThemeMode; icon: LucideIcon; labelKey: string }[] = [
  { mode: 'light', icon: Sun, labelKey: 'demo.theme.light' },
  { mode: 'dark', icon: Moon, labelKey: 'demo.theme.dark' },
];

/**
 * 演示用控件：主题 + 语言切换，仅用于展示 shared/theme 与 shared/i18n 已接线可用。
 * 迁入业务项目后可整体删除（见 docs/frontend/guides/theming-and-i18n.md）。
 */
export function DemoControls() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const { locale, setLocale, available } = useLocale();

  return (
    <div className={styles.root}>
      <div className={styles.group} role="group" aria-label={t('demo.theme.label')}>
        {THEME_OPTIONS.map(({ mode: value, icon: Icon, labelKey }) => (
          <button
            key={value}
            type="button"
            className={styles.button}
            aria-pressed={mode === value}
            data-active={mode === value}
            onClick={() => setMode(value)}
            title={t(labelKey)}
          >
            <Icon size={16} aria-hidden />
            <span className={styles.buttonText}>{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <div className={styles.group} role="group" aria-label={t('demo.language.label')}>
        <Languages size={16} aria-hidden className={styles.groupIcon} />
        {available.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.button}
            aria-pressed={locale === value}
            data-active={locale === value}
            onClick={() => setLocale(value)}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
