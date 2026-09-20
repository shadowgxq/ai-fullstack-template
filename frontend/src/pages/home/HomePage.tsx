import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-[var(--section-gap)]">
      <section
        data-page-motion
        className="rounded-[var(--radius-panel)] border border-border-subtle bg-hero p-6 sm:p-10"
      >
        <p className="mb-4 font-mono text-xs text-primary">React · Vite · TypeScript</p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
          {t('home.title')}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          {t('home.description')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/components">{t('home.components')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/theme">{t('home.theme')}</Link>
          </Button>
        </div>
      </section>
      <section data-page-motion className="grid gap-4 md:grid-cols-3">
        {(['components', 'integration', 'docs'] as const).map((key) => (
          <article
            key={key}
            className="rounded-[var(--radius-card)] border border-border-subtle bg-card p-6"
          >
            <h2 className="text-lg font-semibold">{t(`home.cards.${key}.title`)}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t(`home.cards.${key}.text`)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
