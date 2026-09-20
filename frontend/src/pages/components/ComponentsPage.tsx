import { useTranslation } from 'react-i18next';
import { ControlDemos } from './ui/ControlDemos';
import { OverlayDemos } from './ui/OverlayDemos';
import { AdvancedDemos } from './ui/AdvancedDemos';

export function ComponentsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{t('gallery.title')}</h1>
        <p className="mt-3 max-w-3xl leading-6 text-muted-foreground">{t('gallery.description')}</p>
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ControlDemos />
        <OverlayDemos />
        <AdvancedDemos />
      </div>
    </div>
  );
}
