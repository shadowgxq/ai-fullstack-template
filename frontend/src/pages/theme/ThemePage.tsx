import { useTranslation } from 'react-i18next';
import { useTheme, THEME_PRESETS } from '@/shared/theme';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/switch';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export function ThemePage() {
  const { t } = useTranslation();
  const { mode, setMode, preset, setPreset } = useTheme();
  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">{t('theme.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('theme.description')}</p>
      </section>
      <section className="space-y-6 rounded-xl border border-border-subtle bg-card p-6">
        <div role="group" aria-label={t('theme.preset')} className="flex flex-wrap gap-3">
          {THEME_PRESETS.map((value) => (
            <Button
              key={value}
              variant={preset === value ? 'default' : 'outline'}
              aria-pressed={preset === value}
              onClick={() => setPreset(value)}
            >
              {t(`theme.${value}`)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="dark-mode"
            checked={mode === 'dark'}
            onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
          />
          <Label htmlFor="dark-mode">{t('theme.dark')}</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="theme-input">{t('gallery.inputLabel')}</Label>
          <Input id="theme-input" placeholder={t('gallery.placeholder')} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button>{t('gallery.primary')}</Button>
          <Button variant="outline">{t('gallery.secondary')}</Button>
          <Button disabled>{t('gallery.disabled')}</Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('theme.persistence')}</p>
      </section>
    </div>
  );
}
