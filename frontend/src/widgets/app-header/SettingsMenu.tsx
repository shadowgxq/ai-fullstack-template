import { useTranslation } from 'react-i18next';

import { useLocale } from '@/shared/i18n';
import { Languages, Moon, Settings } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Switch } from '@/shared/ui/switch';
import { cn } from '@/shared/utils/cn';

/**
 * Header 的全局设置入口，保留语言与明暗模式等全局偏好。
 */
export function SettingsMenu() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const { locale, setLocale, available } = useLocale();
  const isDark = mode === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none max-md:min-h-[var(--control-hit-size)] max-md:min-w-[var(--control-hit-size)]"
          aria-label={t('header.settings')}
          title={t('header.settings')}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className="w-[244px] min-w-[244px] max-w-[244px] rounded-[10px] border-border/70 bg-popover p-2 shadow-sm ring-1 ring-foreground/5 max-[480px]:w-[calc(100vw-1.5rem)] max-[480px]:min-w-0 max-[480px]:max-w-[calc(100vw-1.5rem)]"
        aria-label={t('header.settings')}
      >
        <div className="flex h-10 items-center justify-between gap-3 px-2.5 max-md:h-auto max-md:min-h-[var(--control-hit-size)]">
          <span className="text-foreground flex items-center gap-3 text-sm font-medium">
            <Languages className="size-[18px] shrink-0" aria-hidden="true" />
            <span>{t('header.language')}</span>
          </span>
          <div
            className="border-border/70 bg-muted/70 inline-flex h-7 rounded-lg border p-0.5 max-md:h-auto"
            role="group"
            aria-label={t('header.language')}
          >
            {available.map((value) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'h-6 min-w-9 rounded-md px-2 text-xs leading-none font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:min-h-[var(--control-hit-size)] max-md:min-w-[var(--control-hit-size)] motion-reduce:transition-none',
                  locale === value
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                )}
                aria-pressed={locale === value}
                aria-label={t('header.languageSwitch', {
                  language: t(`header.locales.${value}`),
                })}
                onClick={() => setLocale(value)}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1 flex h-10 items-center justify-between gap-3 px-2.5 max-md:min-h-[var(--control-hit-size)]">
          <span className="text-foreground flex items-center gap-3 text-sm font-medium">
            <Moon className="size-[18px] shrink-0" aria-hidden="true" />
            <span>{t('header.theme.label')}</span>
          </span>
          <Switch
            size="lg"
            checked={isDark}
            aria-label={t('header.theme.label')}
            onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
