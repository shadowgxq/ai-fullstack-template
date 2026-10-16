import { useTranslation } from 'react-i18next';

import { useLocale } from '@/shared/i18n';
import { Languages, Moon, Settings } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Switch } from '@/shared/ui/switch';

/** Header 的全局设置入口；表单控件放在 Popover 中，保留正常 Tab 导航。 */
export function SettingsMenu() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const { locale, setLocale, available } = useLocale();
  const isDark = mode === 'dark';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('header.settings')}
          title={t('header.settings')}
        >
          <Settings aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        variant="compact"
        align="end"
        side="bottom"
        collisionPadding={16}
        aria-label={t('header.settings')}
      >
        <div className="flex min-h-[var(--control-hit-size)] items-center justify-between gap-[var(--space-3)] px-[var(--space-2-5)]">
          <span className="flex items-center gap-[var(--space-2)] text-sm font-medium text-foreground">
            <Languages className="size-[var(--icon-size-md)] shrink-0" aria-hidden="true" />
            <span>{t('header.language')}</span>
          </span>
          <div
            className="inline-flex gap-[var(--space-1)] rounded-[var(--radius-control)] bg-muted p-[var(--space-0-5)]"
            role="group"
            aria-label={t('header.language')}
          >
            {available.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={locale === value ? 'default' : 'ghost'}
                aria-pressed={locale === value}
                aria-label={t('header.languageSwitch', { language: t(`header.locales.${value}`) })}
                onClick={() => setLocale(value)}
              >
                {value.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex min-h-[var(--control-hit-size)] items-center justify-between gap-[var(--space-3)] px-[var(--space-2-5)]">
          <span className="flex items-center gap-[var(--space-2)] text-sm font-medium text-foreground">
            <Moon className="size-[var(--icon-size-md)] shrink-0" aria-hidden="true" />
            <span>{t('header.theme.label')}</span>
          </span>
          <Switch
            checked={isDark}
            aria-label={t('header.theme.label')}
            onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
