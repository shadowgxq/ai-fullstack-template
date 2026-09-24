import {
  ArrowLeft,
  ArrowRight,
  Braces,
  CheckCircle2,
  Languages,
  Layers3,
  Monitor,
  Palette,
  Share2,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { ShareDialog, type ShareContent } from '../../features/share';
import { AppShell } from '../../widgets/app-shell';
import { cn } from '@/shared/utils/cn';

const overviewSections = [
  { key: 'appShell', Icon: Monitor },
  { key: 'layeredSource', Icon: Layers3 },
  { key: 'projectDocs', Icon: Braces },
] as const;

const overviewCapabilities = [
  { key: 'appShell', Icon: Monitor },
  { key: 'authShare', Icon: UserRound },
  { key: 'i18n', Icon: Languages },
  { key: 'tokens', Icon: Palette },
  { key: 'layeredSource', Icon: Layers3 },
] as const;

const foundationModules: ReadonlyArray<{
  key: 'tokens' | 'auth' | 'share' | 'i18n';
  path: string;
  Icon: LucideIcon;
}> = [
  { key: 'tokens', path: 'shared/styles', Icon: Palette },
  { key: 'auth', path: 'features/auth', Icon: ShieldCheck },
  { key: 'share', path: 'features/share', Icon: Share2 },
  { key: 'i18n', path: 'shared/i18n', Icon: Languages },
];

const foundationStepKeys = ['contract', 'compose', 'replace'] as const;

function escapeSvgText(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return character;
    }
  });
}

/* 两个视图共用的排版，提出来避免两处各写一遍后走样。 */
const viewClass =
  'min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500';
const badgeClass =
  'border-primary/25 bg-card/75 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 font-sans text-xs font-semibold';
const heroStatusClass =
  'border-primary/30 bg-primary/10 text-primary inline-flex items-center justify-center rounded-full border px-5 py-2 font-sans text-base leading-none font-medium';
const titleClass =
  'text-foreground font-sans mt-6 max-w-[820px] text-[clamp(2.75rem,5.5vw,4.25rem)] leading-[1.06] font-bold tracking-[-0.015em] max-[480px]:text-[clamp(2.5rem,13vw,3.4rem)]';
const descriptionClass =
  'text-muted-foreground mt-7 max-w-[650px] text-lg leading-[1.65] max-[480px]:text-base';
const actionsClass = 'mt-8 flex flex-wrap items-center gap-4';
const ctaClass =
  'group bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex items-center gap-2 rounded-md border border-transparent px-6 py-3 text-base font-medium no-underline shadow-md transition-all hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none';
const secondaryCtaClass =
  'group border-border bg-card text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:ring-ring inline-flex items-center gap-2 rounded-md border px-6 py-3 text-base font-medium no-underline shadow-sm transition-all focus-visible:ring-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none';
const eyebrowClass = 'text-primary font-mono text-xs tracking-[0.12em] uppercase';
const cardClass =
  'border-border bg-card hover:border-primary/40 rounded-xl border transition-all hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none';
const cardTitleClass = 'text-foreground font-sans mt-3 text-lg font-semibold';
const cardTextClass = 'text-muted-foreground mt-2 text-sm leading-relaxed';
const sectionHeadingClass = 'text-foreground font-sans text-3xl font-semibold';
const footerClass = 'border-border text-muted-foreground mt-12 border-t pt-6 text-sm';

function OverviewContent() {
  const { t } = useTranslation();

  return (
    <div className={viewClass}>
      <div className="relative pb-12">
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-screen -translate-x-1/2 bg-hero"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-page"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <section
            className="grid grid-cols-[minmax(0,1fr)_minmax(420px,0.88fr)] items-center gap-16 pt-4 max-[980px]:grid-cols-1 max-[980px]:gap-12 max-[480px]:gap-8"
            aria-labelledby="home-title"
          >
            <div className="min-w-0 max-w-[680px]">
              <span className={heroStatusClass}>{t('home.status')}</span>

              <h1 id="home-title" className={titleClass}>
                <span className="block">{t('home.titleLead')}</span>
                <span className="text-primary block">{t('home.titleAccent')}</span>
              </h1>
              <p className={descriptionClass}>{t('home.description')}</p>

              <div className={actionsClass}>
                <Link className={ctaClass} to="/foundation">
                  {t('home.cta')}
                  <ArrowRight
                    className="transition-transform motion-safe:group-hover:translate-x-[3px] motion-reduce:transition-none"
                    size={18}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>

            <aside
              className="border-border/70 bg-card/90 min-w-0 rounded-2xl border p-5 shadow-lg backdrop-blur-sm max-[480px]:p-4"
              aria-labelledby="home-capabilities-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="home-capabilities-title"
                    className="text-foreground font-heading text-2xl font-semibold"
                  >
                    {t('home.capabilities.title')}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {t('home.capabilities.description')}
                  </p>
                </div>
                <span className={cn(badgeClass, 'shrink-0 max-[480px]:hidden')}>
                  <span
                    className="bg-primary ring-primary/20 size-1.5 rounded-full ring-3"
                    aria-hidden="true"
                  />
                  {t('home.capabilities.ready')}
                </span>
              </div>

              <div className="border-border/60 bg-background/45 mt-6 overflow-hidden rounded-xl border">
                {overviewCapabilities.map(({ key, Icon }) => (
                  <div
                    className="border-border/60 grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 max-[480px]:grid-cols-[24px_minmax(0,1fr)] max-[480px]:px-3"
                    key={key}
                  >
                    <Icon className="text-primary" size={20} strokeWidth={1.8} aria-hidden="true" />
                    <div className="min-w-0">
                      <h3 className="text-foreground text-sm font-semibold">
                        {t(`home.capabilities.items.${key}.title`)}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {t(`home.capabilities.items.${key}.text`)}
                      </p>
                    </div>
                    <span className="text-success inline-flex items-center gap-1 text-xs font-medium max-[480px]:hidden">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      {t('home.capabilities.itemReady')}
                    </span>
                  </div>
                ))}
              </div>

              <Link className={cn(ctaClass, 'mt-5 w-full justify-center')} to="/foundation">
                {t('home.capabilities.cta')}
                <ArrowRight
                  className="transition-transform motion-safe:group-hover:translate-x-[3px] motion-reduce:transition-none"
                  size={18}
                  aria-hidden="true"
                />
              </Link>
            </aside>
          </section>

          <section
            className="border-border mt-16 grid grid-cols-3 gap-0 border-y py-11 max-[760px]:mt-12 max-[760px]:grid-cols-1 max-[760px]:gap-0"
            aria-label={t('home.overviewLabel')}
          >
            {overviewSections.map(({ key, Icon }, index) => (
              <article
                className="border-border/70 group border-r px-7 first:pl-0 last:border-r-0 last:pr-0 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:px-0 max-[760px]:py-8 first:max-[760px]:pt-0 last:max-[760px]:border-b-0 last:max-[760px]:pb-0"
                key={key}
              >
                <span className={eyebrowClass}>{String(index + 1).padStart(2, '0')}</span>
                <div className="mt-5 flex items-start gap-5">
                  <span
                    className="bg-primary/10 text-primary inline-grid size-12 shrink-0 place-items-center rounded-full"
                    aria-hidden="true"
                  >
                    <Icon size={21} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <h2 className={cardTitleClass}>{t(`home.sections.${key}.title`)}</h2>
                    <p className={cardTextClass}>{t(`home.sections.${key}.text`)}</p>
                    <Link
                      className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-semibold no-underline transition-colors hover:text-primary/75"
                      to="/foundation"
                    >
                      {t('home.learnMore')}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function FoundationContent() {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const shareTitle = t('app.title');
  const shareSlogan = t('home.foundation.modules.share.title');
  const shareResult = t('home.foundation.modules.share.text');
  const shareContent = useMemo<ShareContent>(() => {
    const posterFile =
      typeof File === 'function'
        ? new File(
            [
              `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f5f7"/>
  <circle cx="1000" cy="-40" r="300" fill="#e4f3f0"/>
  <text x="80" y="118" fill="#087f73" font-family="sans-serif" font-size="24">${escapeSvgText(shareSlogan)}</text>
  <text x="80" y="218" fill="#1d2321" font-family="sans-serif" font-size="56" font-weight="700">${escapeSvgText(shareTitle)}</text>
  <text x="80" y="310" fill="#087f73" font-family="sans-serif" font-size="48" font-weight="700">${escapeSvgText(shareSlogan)}</text>
  <text x="80" y="392" fill="#6d7673" font-family="sans-serif" font-size="24">${escapeSvgText(shareResult)}</text>
  <rect x="80" y="494" width="168" height="52" rx="26" fill="#087f73"/>
  <text x="164" y="527" fill="#ffffff" font-family="sans-serif" font-size="20" text-anchor="middle">Signal Teal</text>
</svg>`,
            ],
            'frontend-agent-template-share.svg',
            { type: 'image/svg+xml' },
          )
        : undefined;

    return {
      title: shareTitle,
      slogan: shareSlogan,
      result: shareResult,
      fullText: [shareSlogan, shareResult].join('\n'),
      landingUrl: typeof window === 'undefined' ? undefined : window.location.href,
      posterFile,
    };
  }, [shareResult, shareSlogan, shareTitle]);

  return (
    <div className={viewClass}>
      <header className="grid grid-cols-[minmax(0,1fr)_280px] items-end gap-16 max-[760px]:grid-cols-1 max-[760px]:gap-8">
        <div className="min-w-0">
          <span className={badgeClass}>
            <Braces size={14} aria-hidden="true" />
            {t('home.foundation.status')}
          </span>
          <h1 className={cn(titleClass, 'text-[clamp(2.6rem,5.4vw,4.35rem)]')}>
            {t('home.foundation.title')}
          </h1>
          <p className={descriptionClass}>{t('home.foundation.description')}</p>
          <div className={actionsClass}>
            <Link className={secondaryCtaClass} to="/">
              <ArrowLeft
                className="transition-transform motion-safe:group-hover:-translate-x-[3px] motion-reduce:transition-none"
                size={18}
                aria-hidden="true"
              />
              {t('home.foundation.back')}
            </Link>
          </div>
        </div>

        <aside
          className="bg-primary text-primary-foreground flex min-h-[270px] flex-col justify-end rounded-xl p-8 shadow-lg max-[760px]:min-h-[210px] max-[480px]:p-6"
          aria-label={t('home.foundation.summaryLabel')}
        >
          <span className="font-mono text-7xl leading-[0.9] font-semibold tracking-[-0.08em]">
            04
          </span>
          <span className="mt-6 text-base font-semibold">{t('home.foundation.summaryLabel')}</span>
          <p className="mt-2 text-sm leading-relaxed opacity-75">
            {t('home.foundation.summaryText')}
          </p>
        </aside>
      </header>

      <section
        className="border-border mt-16 border-t pt-12"
        aria-labelledby="foundation-catalog-title"
      >
        <div className="flex items-end justify-between gap-6">
          <span className={eyebrowClass}>{t('home.foundation.catalogEyebrow')}</span>
          <h2 id="foundation-catalog-title" className={sectionHeadingClass}>
            {t('home.foundation.catalogTitle')}
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          {foundationModules.map(({ key, path, Icon }) => {
            const isShareModule = key === 'share';

            return (
              <article
                className={cn(
                  cardClass,
                  'flex min-h-[220px] flex-col p-6',
                  isShareModule &&
                    'cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                )}
                key={key}
                role={isShareModule ? 'button' : undefined}
                tabIndex={isShareModule ? 0 : undefined}
                aria-haspopup={isShareModule ? 'dialog' : undefined}
                aria-label={isShareModule ? t('home.foundation.shareDemo.open') : undefined}
                onClick={isShareModule ? () => setShareOpen(true) : undefined}
                onKeyDown={
                  isShareModule
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        setShareOpen(true);
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="bg-primary/10 text-primary inline-grid size-10 place-items-center rounded-md"
                    aria-hidden="true"
                  >
                    <Icon size={20} />
                  </span>
                  <span className="text-success font-mono text-xs tracking-[0.08em]">
                    {t('home.foundation.ready')}
                  </span>
                </div>
                <h3 className={cardTitleClass}>{t(`home.foundation.modules.${key}.title`)}</h3>
                <p className={cardTextClass}>{t(`home.foundation.modules.${key}.text`)}</p>
                {isShareModule ? (
                  <span className="text-primary mt-auto flex items-center gap-1 pt-6 text-xs font-semibold">
                    {t('home.foundation.shareDemo.open')}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                ) : (
                  <code className="text-primary mt-auto pt-6 font-mono text-xs">{path}</code>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <ShareDialog
        open={shareOpen}
        content={shareContent}
        onOpenChange={setShareOpen}
        title={t('home.foundation.shareDemo.title')}
        description={t('home.foundation.shareDemo.description')}
        poster={
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
            <div className="from-primary/15 via-background to-background bg-gradient-to-br p-6 sm:p-10">
              <span className="text-primary font-mono text-xs tracking-[0.12em] uppercase">
                {t('home.foundation.status')}
              </span>
              <h3 className="text-foreground mt-8 text-3xl font-bold tracking-tight sm:text-5xl">
                {shareTitle}
              </h3>
              <p className="text-primary mt-3 text-2xl font-bold sm:text-4xl">{shareSlogan}</p>
              <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
                {shareResult}
              </p>
              <div className="mt-10 flex flex-wrap gap-2">
                <span className="border-primary/20 bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs font-semibold">
                  H5
                </span>
                <span className="border-border bg-background text-muted-foreground rounded-full border px-3 py-1 text-xs font-semibold">
                  Desktop
                </span>
                <span className="border-border bg-background text-muted-foreground rounded-full border px-3 py-1 text-xs font-semibold">
                  Clipboard
                </span>
              </div>
            </div>
          </div>
        }
      />

      <section
        className="border-border/60 bg-muted/40 mt-12 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-12 rounded-xl border p-8 max-[760px]:grid-cols-1 max-[480px]:p-6"
        aria-labelledby="foundation-handoff-title"
      >
        <div className="flex flex-col items-start gap-3">
          <span className={eyebrowClass}>{t('home.foundation.handoff.eyebrow')}</span>
          <h2 id="foundation-handoff-title" className={sectionHeadingClass}>
            {t('home.foundation.handoff.title')}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('home.foundation.handoff.description')}
          </p>
        </div>

        <ol className="m-0 grid list-none gap-3 p-0">
          {foundationStepKeys.map((key, index) => (
            <li
              className="border-border/60 grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0"
              key={key}
            >
              <span className="text-primary font-mono text-xs">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="text-foreground text-sm leading-relaxed">
                {t(`home.foundation.handoff.steps.${key}`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <footer className={footerClass}>{t('home.foundation.footer')}</footer>
    </div>
  );
}

export function HomePage() {
  const location = useLocation();
  const isFoundation = location.pathname === '/foundation';

  return (
    <AppShell>
      <div
        className="group/page bg-page text-foreground relative min-h-0 overflow-x-hidden"
        data-view={isFoundation ? 'foundation' : 'overview'}
      >
        {/* Foundation 保留首屏底色；Overview 的 Hero 背景层在内容容器外全宽铺开。 */}
        {isFoundation ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[calc(100dvh-64px)] max-h-[760px] bg-hero max-[760px]:h-[calc(100dvh-60px)]"
            aria-hidden="true"
          />
        ) : null}
        <main
          id="main-content"
          className="relative z-1 mx-auto w-[min(100%-3rem,var(--layout-max-width))] py-14 max-[760px]:py-10 max-[480px]:w-[min(100%-1.5rem,var(--layout-max-width))] max-[480px]:py-8"
          tabIndex={-1}
        >
          {isFoundation ? <FoundationContent /> : <OverviewContent />}
        </main>
      </div>
    </AppShell>
  );
}
