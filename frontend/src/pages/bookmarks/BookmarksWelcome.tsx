import {
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  FileText,
  Folder,
  LockKeyhole,
  Search,
  Wrench,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../shared/ui/button';

type BookmarksWelcomeProps = {
  onLogin: () => void;
};

const uses = [
  { key: 'save', Icon: BookmarkPlus },
  { key: 'organize', Icon: Folder },
  { key: 'find', Icon: Search },
] as const;

/** Guest examples describe the product without reading or exposing private bookmarks. */
export function BookmarksWelcome({ onLogin }: BookmarksWelcomeProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-[var(--layout-max-width)] px-[var(--space-6)] pt-[var(--space-10)] pb-[var(--space-8)] md:px-0 md:pt-[var(--space-16)] md:pb-[var(--space-10)]">
      <div className="flex flex-col gap-[var(--space-10)] md:flex-row md:items-center md:gap-[var(--space-10)] md:py-[var(--space-8)] xl:gap-[var(--space-16)] xl:px-[var(--space-16)]">
        <section
          aria-labelledby="bookmarks-welcome-title"
          className="flex min-w-0 flex-1 flex-col gap-[var(--space-6)]"
        >
          <div className="text-primary flex items-center gap-[var(--space-2)]">
            <span className="bg-primary-subtle inline-flex size-12 items-center justify-center rounded-[var(--radius-surface)] md:size-auto md:bg-transparent">
              <Bookmark className="size-5 md:size-4" aria-hidden="true" />
            </span>
            <span className="hidden text-sm md:inline">{t('bookmarks.welcome.position')}</span>
          </div>
          <div className="space-y-[var(--space-3)] md:space-y-[var(--space-6)]">
            <h1
              id="bookmarks-welcome-title"
              className="text-[length:var(--text-page-title-size)] leading-[var(--text-page-title-line)] font-semibold"
            >
              <span className="md:block">{t('bookmarks.welcome.titleLead')}</span>
              <span>{t('bookmarks.welcome.titleEnd')}</span>
            </h1>
            <p className="text-muted-foreground leading-[var(--text-body-line)]">
              {t('bookmarks.welcome.description')}
              <span className="hidden md:block" />
              {t('bookmarks.loginRequired')}
            </p>
          </div>
          <div className="flex flex-col gap-[var(--space-3)]">
            <Button
              onClick={onLogin}
              className="w-full min-h-[var(--control-hit-size)] md:w-fit md:min-h-[var(--button-height-md)]"
            >
              <ArrowRight aria-hidden="true" className="hidden md:block" />
              {t('bookmarks.welcome.login')}
            </Button>
            <p className="text-muted-foreground flex items-center justify-center gap-[var(--space-2)] text-xs md:justify-start">
              <LockKeyhole className="text-primary size-3.5" aria-hidden="true" />
              {t('bookmarks.welcome.private')}
            </p>
          </div>
        </section>

        <section
          aria-label={t('bookmarks.welcome.exampleLabel')}
          className="bg-card border-border-subtle rounded-[var(--radius-surface)] border p-[var(--space-5)] md:w-[520px] md:max-w-[48%] md:flex-none md:p-[var(--space-6)]"
        >
          <div className="hidden md:block">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{t('bookmarks.welcome.exampleTitle')}</h2>
              <span className="text-muted-foreground text-xs">
                {t('bookmarks.welcome.exampleLabel')}
              </span>
            </div>
            <div className="my-[var(--space-5)] flex flex-wrap gap-[var(--space-2)] text-xs">
              {['learning', 'tools', 'payment'].map((key) => (
                <span
                  key={key}
                  className="border-border-subtle bg-background rounded-[var(--radius-control)] border px-2 py-1"
                >
                  {t(`bookmarks.welcome.groups.${key}`)}
                </span>
              ))}
            </div>
            {[
              { key: 'react', group: 'learning', Icon: FileText },
              { key: 'tools', group: 'tools', Icon: Wrench },
            ].map(({ key, group, Icon }) => (
              <div
                key={key}
                className="border-border-subtle flex gap-[var(--space-4)] border-t py-[var(--space-4)]"
              >
                <Icon className="text-primary size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                  <h3 className="font-medium">{t(`bookmarks.welcome.examples.${key}.title`)}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t(`bookmarks.welcome.examples.${key}.description`)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t(`bookmarks.welcome.groups.${group}`)}
                  </p>
                </div>
              </div>
            ))}
            <p className="bg-primary-subtle flex items-center gap-2.5 rounded-[var(--radius-control)] p-3 text-sm">
              <Search className="text-primary size-4 shrink-0" aria-hidden="true" />
              {t('bookmarks.welcome.findHint')}
            </p>
          </div>
          <div className="space-y-[var(--space-5)] md:hidden">
            <p className="text-muted-foreground text-xs">{t('bookmarks.welcome.staticLabel')}</p>
            {uses.map(({ key, Icon }) => (
              <div key={key} className="flex gap-[var(--space-3)]">
                <span className="bg-primary-subtle text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="font-medium">{t(`bookmarks.welcome.uses.${key}.mobileTitle`)}</h2>
                  <p className="text-muted-foreground text-sm">
                    {t(`bookmarks.welcome.uses.${key}.mobileDescription`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="border-border-subtle mt-[var(--space-10)] hidden gap-[var(--space-10)] border-t py-[var(--space-8)] md:grid md:grid-cols-3 xl:px-[var(--space-16)]">
        {uses.map(({ key, Icon }) => (
          <section key={key} className="space-y-[var(--space-3)]">
            <h2 className="flex items-center gap-[var(--space-3)] font-semibold">
              <Icon className="text-primary size-5 shrink-0" aria-hidden="true" />
              {t(`bookmarks.welcome.uses.${key}.title`)}
            </h2>
            <p className="text-muted-foreground">
              {t(`bookmarks.welcome.uses.${key}.description`)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
