import { ArrowRight } from 'lucide-react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { SharePosterData, SharePosterResearchBrief } from '../../model/share.types';
import styles from './ShareDialog.module.css';

export type SharePosterProps = {
  poster: SharePosterData;
};

const POSTER_REMARK_PLUGINS = [remarkGfm];
const POSTER_ITEM_LIMITS = {
  metadata: 3,
  highlights: 3,
  metrics: 3,
  signals: 2,
} as const;

const POSTER_MARKDOWN_COMPONENTS: Components = {
  h1: () => null,
  h2: () => null,
  h3: () => null,
  h4: () => null,
  h5: () => null,
  h6: () => null,
  a({ node, children }) {
    void node;
    return <span>{children}</span>;
  },
  img: () => null,
  table: () => null,
  pre: () => null,
  code({ node, children }) {
    void node;
    return <span>{children}</span>;
  },
};

function getDecisionTextSize(value: string): 'large' | 'medium' | 'small' {
  const length = Array.from(value.trim()).length;
  const hasWideCharacters = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(value);
  const largeLimit = hasWideCharacters ? 2 : 6;
  const mediumLimit = hasWideCharacters ? 5 : 12;

  if (length <= largeLimit) return 'large';
  if (length <= mediumLimit) return 'medium';
  return 'small';
}

function formatPosterDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getProductHost(value: string): string | undefined {
  try {
    const host = new URL(value).host;
    return /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host) ? undefined : host;
  } catch {
    return value === '/' ? undefined : value;
  }
}

type ResearchBriefContentProps = Readonly<{
  brief: SharePosterResearchBrief;
  poster: SharePosterData;
  dataAsOfLabel?: string;
  disclaimer: string;
  ctaLabel: string;
  fallbackDecision: string;
}>;

function ResearchBriefContent({
  brief,
  poster,
  dataAsOfLabel,
  disclaimer,
  ctaLabel,
  fallbackDecision,
}: ResearchBriefContentProps) {
  const decision = brief.decision || fallbackDecision;

  return (
    <>
      <h3 className={styles.posterBriefTitle}>{poster.title}</h3>
      <div className={styles.posterBriefGrid}>
        <section className={styles.posterBriefPrimary} aria-label={brief.decisionLabel}>
          {poster.badge ? (
            <div className={styles.posterBriefBadge}>
              <span aria-hidden />
              <span className={styles.singleLineText}>{poster.badge}</span>
            </div>
          ) : null}
          <span className={`${styles.posterBriefFieldLabel} ${styles.singleLineText}`}>
            {brief.decisionLabel}
          </span>
          <strong
            className={`${styles.posterBriefDecision} ${styles.singleLineText}`}
            data-text-size={getDecisionTextSize(decision)}
          >
            {decision}
          </strong>
          {brief.confidence ? (
            <div className={styles.posterBriefConfidence}>
              <span aria-hidden />
              <span className={styles.posterBriefConfidenceText}>
                {brief.confidenceLabel ? <span>{brief.confidenceLabel}</span> : null}
                <strong>{brief.confidence}</strong>
              </span>
            </div>
          ) : null}
          {brief.summary ? (
            <p
              className={`${styles.posterBriefSummary} ${styles.lineClamp} ${styles.clampThreeLines}`}
            >
              {brief.summary}
            </p>
          ) : null}
          {brief.summaryDetail ? (
            <p
              className={`${styles.posterBriefSummaryDetail} ${styles.lineClamp} ${styles.clampTwoLines}`}
            >
              {brief.summaryDetail}
            </p>
          ) : null}
        </section>

        <section className={styles.posterBriefDetails} aria-label={brief.metricsLabel}>
          <span className={`${styles.posterBriefSectionLabel} ${styles.singleLineText}`}>
            {brief.metricsLabel}
          </span>
          {brief.metrics.length ? (
            <dl className={styles.posterBriefMetrics}>
              {brief.metrics.slice(0, POSTER_ITEM_LIMITS.metrics).map((metric) => (
                <div data-tone={metric.tone ?? 'neutral'} key={`${metric.label}-${metric.value}`}>
                  <dt className={styles.singleLineText}>{metric.label}</dt>
                  <dd className={`${styles.lineClamp} ${styles.clampThreeLines}`}>
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {brief.signals.length ? (
            <div className={styles.posterBriefSignals}>
              {brief.signals.slice(0, POSTER_ITEM_LIMITS.signals).map((signal) => (
                <dl
                  className={styles.posterBriefSignal}
                  data-tone={signal.tone ?? 'neutral'}
                  key={`${signal.label}-${signal.value}`}
                >
                  <dt className={styles.singleLineText}>{signal.label}</dt>
                  <dd className={`${styles.lineClamp} ${styles.clampTwoLines}`}>{signal.value}</dd>
                </dl>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className={styles.posterBriefFooter}>
        <div className={styles.posterBriefFooterMeta}>
          {dataAsOfLabel ? <span className={styles.singleLineText}>{dataAsOfLabel}</span> : null}
          <span className={styles.singleLineText}>{disclaimer}</span>
        </div>
        <div className={styles.posterCta}>
          <strong className={styles.singleLineText}>{ctaLabel}</strong>
          <ArrowRight size={22} aria-hidden />
        </div>
      </div>
    </>
  );
}

export const SharePoster = forwardRef<HTMLDivElement, SharePosterProps>(function SharePoster(
  { poster },
  ref,
) {
  const { t, i18n } = useTranslation();
  const productHost = getProductHost(poster.productEntry);
  const isResearchBrief = poster.variant === 'research-brief';
  const researchBrief = isResearchBrief ? poster.researchBrief : undefined;
  const formattedDate = poster.dataDate
    ? formatPosterDate(poster.dataDate, i18n.resolvedLanguage ?? i18n.language)
    : undefined;
  const dataAsOfLabel = formattedDate
    ? t('share.poster.dataAsOf', { date: formattedDate })
    : undefined;

  return (
    <div
      ref={ref}
      className={styles.poster}
      data-share-poster
      data-variant={poster.variant ?? 'default'}
      data-layout={researchBrief ? 'conclusion-share' : undefined}
      aria-label={poster.title}
    >
      <div className={styles.posterSheet}>
        <div className={styles.posterHeader}>
          <div className={styles.posterBrand}>
            <span className={`${styles.posterEyebrow} ${styles.singleLineText}`}>
              {poster.eyebrow ?? t('share.poster.eyebrow')}
            </span>
            {isResearchBrief ? (
              <span className={`${styles.posterSignal} ${styles.singleLineText}`}>
                {t('share.poster.signal')}
              </span>
            ) : null}
          </div>
          {poster.metadata?.length ? (
            <div className={styles.posterMetadata} aria-label={t('share.poster.metadata')}>
              {poster.metadata.slice(0, POSTER_ITEM_LIMITS.metadata).map((item, index) => (
                <span className={styles.singleLineText} key={`${item}-${index}`}>
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {researchBrief ? (
          <ResearchBriefContent
            brief={researchBrief}
            poster={poster}
            dataAsOfLabel={dataAsOfLabel}
            disclaimer={t('share.poster.disclaimer')}
            ctaLabel={t('share.poster.cta')}
            fallbackDecision={t('companyResearch.decision.UNKNOWN')}
          />
        ) : (
          <>
            {poster.badge ? (
              <div className={styles.posterBadge}>
                <span aria-hidden="true" />
                <span className={styles.singleLineText}>{poster.badge}</span>
              </div>
            ) : null}
            <h3 className={styles.posterTitle}>{poster.title}</h3>
            {poster.identity ? <p className={styles.posterIdentity}>{poster.identity}</p> : null}
            {poster.highlights?.length ? (
              <section
                className={styles.posterHighlights}
                aria-label={t('share.poster.highlights')}
              >
                {poster.highlights
                  .slice(0, POSTER_ITEM_LIMITS.highlights)
                  .map((highlight, index) => (
                    <article
                      className={styles.posterHighlight}
                      key={`${highlight.label}-${highlight.title}`}
                    >
                      <span className={styles.posterHighlightLabel}>
                        {String(index + 1).padStart(2, '0')} / {highlight.label}
                      </span>
                      <strong>{highlight.title}</strong>
                      {highlight.description ? <p>{highlight.description}</p> : null}
                    </article>
                  ))}
              </section>
            ) : null}
            {poster.conclusion ? (
              <section
                className={`${styles.posterBlock} ${styles.posterConclusionBlock}`}
                aria-label={poster.conclusionLabel}
              >
                {poster.conclusionLabel ? (
                  <span className={styles.posterBlockLabel}>{poster.conclusionLabel}</span>
                ) : null}
                <div className={styles.posterConclusion}>
                  <ReactMarkdown
                    components={POSTER_MARKDOWN_COMPONENTS}
                    remarkPlugins={POSTER_REMARK_PLUGINS}
                    skipHtml
                  >
                    {poster.conclusion}
                  </ReactMarkdown>
                </div>
              </section>
            ) : null}
            {poster.candidates?.length ? (
              <section
                className={`${styles.posterBlock} ${styles.posterCandidatesBlock}`}
                aria-label={poster.candidatesLabel}
              >
                {poster.candidatesLabel ? (
                  <span className={styles.posterBlockLabel}>{poster.candidatesLabel}</span>
                ) : null}
                <ol className={styles.posterCandidates}>
                  {poster.candidates.map((candidate, index) => (
                    <li
                      className={styles.posterCandidate}
                      key={`${candidate.rank}-${candidate.title}-${candidate.ticker ?? ''}-${index}`}
                    >
                      <span className={styles.posterCandidateRank} aria-hidden="true">
                        {String(candidate.rank).padStart(2, '0')}
                      </span>
                      <div className={styles.posterCandidateContent}>
                        <div className={styles.posterCandidateHeading}>
                          <strong>{candidate.title}</strong>
                          {candidate.ticker ? <span>{candidate.ticker}</span> : null}
                        </div>
                        {candidate.reason ? <p>{candidate.reason}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {poster.sections?.length ? (
              <div className={styles.posterSections}>
                {poster.sections.map((section) => (
                  <div className={styles.posterSection} key={`${section.label}-${section.value}`}>
                    <span className={styles.posterSectionLabel}>{section.label}</span>
                    <p className={styles.posterSectionValue}>{section.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <div className={styles.posterBottom}>
              {poster.riskStatement ? (
                <div className={styles.posterRisk}>
                  {poster.riskLabel ? (
                    <span className={styles.posterBlockLabel}>{poster.riskLabel}</span>
                  ) : null}
                  <p>{poster.riskStatement}</p>
                </div>
              ) : null}
              {isResearchBrief ? (
                <div className={styles.posterCta}>
                  <strong>{t('share.poster.cta')}</strong>
                  <ArrowRight size={22} aria-hidden />
                </div>
              ) : null}
            </div>
            <div className={styles.posterFooter}>
              {formattedDate ? (
                <span>{t('share.poster.dataAsOf', { date: formattedDate })}</span>
              ) : null}
              <span>
                {isResearchBrief
                  ? t('share.poster.disclaimer')
                  : `${t('header.brand')}${productHost ? ` · ${productHost}` : ''}`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
