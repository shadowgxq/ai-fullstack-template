import { Check, Moon, Palette } from '@/shared/icons';
import { THEME_PRESETS, type ThemePreset, useTheme } from '@/shared/theme';
import { cn } from '@/shared/utils/cn';
import { useTranslation } from 'react-i18next';

import { AppShell } from '../../widgets/app-shell';

const presetMeta: Record<
  ThemePreset,
  {
    descriptionKey: string;
    labelKey: string;
  }
> = {
  signal: {
    labelKey: 'header.theme.presets.signal',
    descriptionKey: 'theme.presets.signal.description',
  },
  neutral: {
    labelKey: 'header.theme.presets.neutral',
    descriptionKey: 'theme.presets.neutral.description',
  },
};

function ThemePreview({ mode, preset }: { mode: 'light' | 'dark'; preset: ThemePreset }) {
  return (
    <div
      className="bg-background border-border/80 min-h-44 rounded-lg border p-3 shadow-sm"
      data-theme={mode}
      data-theme-preset={preset}
      aria-hidden="true"
    >
      <div className="border-border flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary size-3 rounded-full" />
          <span className="bg-muted h-2 w-20 rounded-full" />
        </div>
        <span className="bg-primary/15 size-6 rounded-md" />
      </div>
      <div className="bg-card border-border/70 mt-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="bg-muted h-2 w-24 rounded-full" />
          <span className="bg-success/30 h-2 w-10 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <span className="bg-primary h-8 rounded-sm opacity-90" />
          <span className="bg-muted h-8 rounded-sm" />
          <span className="bg-destructive/25 h-8 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function ThemePage() {
  const { t } = useTranslation();
  const { mode, preset, setPreset } = useTheme();

  return (
    <AppShell>
      <div className="bg-background text-foreground min-h-[calc(100dvh-4rem)] overflow-x-hidden">
        <main
          id="main-content"
          className="mx-auto w-[min(100%-3rem,960px)] py-12 max-[480px]:w-[min(100%-1.5rem,960px)] max-[480px]:py-8"
          tabIndex={-1}
        >
          <header className="max-w-[760px]">
            <span className="border-border bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 font-sans text-xs tracking-[0.04em]">
              <Palette size={14} aria-hidden="true" />
              {t('theme.status')}
            </span>
            <h1 className="text-foreground font-sans mt-6 max-w-[820px] text-[clamp(2.75rem,6vw,4.75rem)] leading-[1.04] font-medium tracking-[-0.015em] max-[480px]:text-[clamp(2.5rem,13vw,3.4rem)]">
              {t('theme.title')}
            </h1>
            <p className="text-muted-foreground mt-6 max-w-[650px] text-lg leading-relaxed max-[480px]:text-base">
              {t('theme.description')}
            </p>
          </header>

          <section
            className="border-border mt-14 border-t pt-10"
            aria-labelledby="theme-options-title"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-primary font-sans text-xs tracking-[0.1em] uppercase">
                  {t('theme.catalogEyebrow')}
                </span>
                <h2
                  id="theme-options-title"
                  className="text-foreground font-sans mt-2 text-3xl font-semibold"
                >
                  {t('theme.catalogTitle')}
                </h2>
              </div>
              <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                <Check size={14} aria-hidden="true" />
                {t('theme.current', {
                  preset: t(presetMeta[preset].labelKey),
                })}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
              {THEME_PRESETS.map((presetKey) => {
                const isActive = preset === presetKey;

                return (
                  <button
                    key={presetKey}
                    type="button"
                    className={cn(
                      'border-border bg-card text-left transition-all motion-reduce:transition-none',
                      'hover:border-primary/50 hover:shadow-md focus-visible:ring-ring rounded-xl border p-4 focus-visible:ring-2 focus-visible:outline-none',
                      isActive && 'border-primary shadow-md ring-2 ring-primary/15',
                    )}
                    aria-pressed={isActive}
                    onClick={() => setPreset(presetKey)}
                  >
                    <ThemePreview mode={mode} preset={presetKey} />
                    <div className="mt-5 flex items-start justify-between gap-4">
                      <div>
                        <span className="text-primary font-sans text-xs tracking-[0.08em] uppercase">
                          {presetKey}
                        </span>
                        <h3 className="text-foreground font-sans mt-2 text-xl font-semibold">
                          {t(presetMeta[presetKey].labelKey)}
                        </h3>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                          {t(presetMeta[presetKey].descriptionKey)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'border-border text-muted-foreground inline-grid size-7 shrink-0 place-items-center rounded-full border',
                          isActive && 'border-primary bg-primary text-primary-foreground',
                        )}
                        aria-hidden="true"
                      >
                        {isActive ? <Check size={16} /> : null}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-border/70 bg-muted/40 mt-12 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-8 rounded-xl border p-8 max-[760px]:grid-cols-1 max-[480px]:p-6">
            <div>
              <span className="text-primary font-sans text-xs tracking-[0.1em] uppercase">
                {t('theme.modeEyebrow')}
              </span>
              <h2 className="text-foreground font-sans mt-2 text-2xl font-semibold">
                {t('theme.modeTitle')}
              </h2>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {t('theme.modeDescription')}
              </p>
            </div>
            <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-5">
              <span className="bg-primary/10 text-primary inline-grid size-10 place-items-center rounded-md">
                <Moon size={20} aria-hidden="true" />
              </span>
              <div>
                <span className="text-muted-foreground text-xs">{t('theme.modeLabel')}</span>
                <strong className="text-foreground mt-1 block text-base">
                  {t(mode === 'dark' ? 'header.theme.dark' : 'header.theme.light')}
                </strong>
              </div>
            </div>
          </section>

          <footer className="border-border text-muted-foreground mt-12 border-t pt-6 text-sm">
            {t('theme.footer')}
          </footer>
        </main>
      </div>
    </AppShell>
  );
}
