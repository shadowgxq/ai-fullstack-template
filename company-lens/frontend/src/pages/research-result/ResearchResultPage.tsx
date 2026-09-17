import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Building2,
  FileText,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
  TriangleAlert,
  TrendingUp,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import {
  getCompanyResearchAdditionalSections,
  getCompanyResearchAgentResults,
  getCompanyResearchAgentResultMarkdown,
  getCompanyResearchCapabilitiesSummary,
  getCompanyResearchDirectAnswer,
  getCompanyResearchIdentityScope,
  getLocalizedCompanyResearchIndustry,
  getLocalizedOverallConclusionField,
  humanizeReportKey,
  isCompanyResearchSummaryAgentName,
  selectCompanyResearchText,
  StructuredReportValue,
  useBindCompanyResearchTask,
  useCompanyResearchReport,
  useCompanyResearchTask,
} from '../../entities/company-research';
import { useAuthStore, useLoginModal } from '../../features/auth';
import { ShareDialog } from '../../features/share';
import { toApiLanguage, translateApiMessage } from '../../shared/api';
import { BackToTop } from '../../shared/ui/BackToTop';
import { MarkdownContent } from '../../shared/ui/MarkdownContent';
import { PageState } from '../../shared/ui/PageState';
import { AppShell } from '../../widgets/app-shell';
import { mapCompanyResearchReportToSharePayload } from './model/research-result-share.mapper';
import { AgentReportReferences } from './ui/AgentReportReferences';
import styles from './ResearchResultPage.module.css';

const CONCLUSION_FIELDS = [
  { key: 'decision', reportKeys: ['decision', 'conclusion'], labelKey: 'decision' },
  { key: 'confidence', reportKeys: ['confidence'], labelKey: 'confidence' },
  {
    key: 'companyQuality',
    reportKeys: ['companyQuality', 'company_quality'],
    labelKey: 'companyQuality',
  },
  {
    key: 'valuationStatus',
    reportKeys: ['valuationStatus', 'valuation_status'],
    labelKey: 'valuationStatus',
  },
  {
    key: 'longTermOutlook',
    reportKeys: ['longTermOutlook', 'long_term_outlook'],
    labelKey: 'longTermOutlook',
  },
  {
    key: 'biggestOpportunity',
    reportKeys: [
      'biggestOpportunity',
      'biggest_opportunity',
      'maximumOpportunity',
      'maximum_opportunity',
    ],
    labelKey: 'biggestOpportunity',
  },
  {
    key: 'biggestRisk',
    reportKeys: ['biggestRisk', 'biggest_risk', 'maximumRisk', 'maximum_risk'],
    labelKey: 'biggestRisk',
  },
] as const;

const CONCLUSION_METRIC_KEYS = [
  'companyQuality',
  'valuationStatus',
  'longTermOutlook',
] as const satisfies readonly (typeof CONCLUSION_FIELDS)[number]['key'][];

const CONCLUSION_SIGNAL_KEYS = [
  'biggestOpportunity',
  'biggestRisk',
] as const satisfies readonly (typeof CONCLUSION_FIELDS)[number]['key'][];

type ConclusionField = Readonly<{
  reportKey: string;
  labelKey: string;
  value: string;
}>;

const CONCLUSION_VALUE_I18N_GROUPS = {
  confidence: 'confidence',
  companyQuality: 'companyQuality',
  valuationStatus: 'valuationStatus',
  longTermOutlook: 'longTermOutlook',
} as const;

function getConclusionDisplayValue(field: ConclusionField, t: TFunction): string {
  const group =
    CONCLUSION_VALUE_I18N_GROUPS[field.reportKey as keyof typeof CONCLUSION_VALUE_I18N_GROUPS];
  return group
    ? t(`companyResearch.conclusion.values.${group}.${field.value.toUpperCase()}`, {
        defaultValue: field.value,
      })
    : field.value;
}

function findConclusionField(
  fields: readonly ConclusionField[],
  reportKey: string,
): ConclusionField | undefined {
  return fields.find((field) => field.reportKey === reportKey);
}

function ConclusionTextTooltip({ className, value }: { className: string; value: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className={className} tabIndex={0} role="note" aria-label={value}>
          {value}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={styles.conclusionTooltip}
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          {value}
          <Tooltip.Arrow className={styles.conclusionTooltipArrow} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function keepTocItemVisible(toc: HTMLElement, item: HTMLAnchorElement) {
  const tocBounds = toc.getBoundingClientRect();
  const itemBounds = item.getBoundingClientRect();
  const verticalDelta =
    itemBounds.top < tocBounds.top
      ? itemBounds.top - tocBounds.top
      : itemBounds.bottom > tocBounds.bottom
        ? itemBounds.bottom - tocBounds.bottom
        : 0;
  const horizontalDelta =
    itemBounds.left < tocBounds.left
      ? itemBounds.left - tocBounds.left
      : itemBounds.right > tocBounds.right
        ? itemBounds.right - tocBounds.right
        : 0;

  if (verticalDelta) toc.scrollTop += verticalDelta;
  if (horizontalDelta) toc.scrollLeft += horizontalDelta;
}

export function ResearchResultPage() {
  const { t, i18n } = useTranslation();
  const language = toApiLanguage(i18n.resolvedLanguage ?? i18n.language);
  const mainRef = useRef<HTMLElement>(null);
  const { projectId: routeTaskId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = routeTaskId?.trim() ?? '';
  const userId = useAuthStore((state) => state.user?.userId);
  const openLogin = useLoginModal((state) => state.openLogin);
  const identityScope = getCompanyResearchIdentityScope(userId);
  const taskQuery = useCompanyResearchTask(taskId || undefined, identityScope, {
    includeMessages: false,
  });
  const task = taskQuery.data;
  const reportQuery = useCompanyResearchReport(task, identityScope);
  const bindMutation = useBindCompanyResearchTask();
  const bindingTaskIdRef = useRef<string>();
  const reportDocument = reportQuery.data;
  const report = reportDocument?.report;
  const reportMarkdown = reportDocument
    ? selectCompanyResearchText(
        language,
        reportDocument.reportMarkdownZh,
        reportDocument.reportMarkdownEn,
        reportDocument.reportMarkdown,
      )
    : undefined;
  const [shareOpen, setShareOpen] = useState(false);
  const title =
    task?.companyName || task?.objectName || task?.query || t('companyResearch.result.title');
  const industry = task
    ? getLocalizedCompanyResearchIndustry(language, task.industryZh, task.industryEn, task.industry)
    : undefined;
  const progressPath = taskId
    ? `/research/${encodeURIComponent(taskId)}/progress`
    : '/research/new';
  const resultPath = taskId ? `/research/${encodeURIComponent(taskId)}/result` : '/research/new';
  const newResearchPath = '/research/new';
  const directAnswer = report ? getCompanyResearchDirectAnswer(report, language) : undefined;
  const capabilitySummary = report ? getCompanyResearchCapabilitiesSummary(report) : undefined;
  const agentResults = report ? getCompanyResearchAgentResults(report) : [];
  const additionalSections = report
    ? getCompanyResearchAdditionalSections(report).filter((section) => section.key !== 'metadata')
    : [];
  const conclusionFields = report
    ? CONCLUSION_FIELDS.flatMap(({ key, reportKeys, labelKey }) => {
        const value = reportKeys
          .map((reportKey) => getLocalizedOverallConclusionField(report, reportKey, language))
          .find(Boolean);
        return value ? [{ reportKey: key, labelKey, value }] : [];
      })
    : [];
  const conclusionFieldByKey = new Map(
    conclusionFields.map((field) => [field.reportKey, field] as const),
  );
  const decisionField = findConclusionField(conclusionFields, 'decision');
  const confidenceField = findConclusionField(conclusionFields, 'confidence');
  const conclusionSummary =
    (report ? getLocalizedOverallConclusionField(report, 'reason', language) : undefined) ??
    directAnswer?.trim();
  const insufficientDataLabel = t('companyResearch.conclusion.insufficientData');
  const conclusionMetricFields = CONCLUSION_METRIC_KEYS.map(
    (reportKey): ConclusionField =>
      conclusionFieldByKey.get(reportKey) ?? {
        reportKey,
        labelKey: reportKey,
        value: insufficientDataLabel,
      },
  );
  const conclusionSignalFields = CONCLUSION_SIGNAL_KEYS.map(
    (reportKey): ConclusionField =>
      conclusionFieldByKey.get(reportKey) ?? {
        reportKey,
        labelKey: reportKey,
        value: insufficientDataLabel,
      },
  );
  const companyFields = task
    ? [
        ['object', task.objectName || task.query],
        ['objectType', task.objectType],
        ['company', task.companyName],
        ['stockCode', task.stockCode],
        ['market', task.market],
        ['exchange', task.exchange],
        ['industry', industry],
        ['keyPeople', task.keyPeople],
        ['relation', task.objectRelation],
        ['researchFocus', task.researchFocus],
        ['createdAt', task.createdAt],
        ['completedAt', task.completedAt],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];
  const tocItems = reportMarkdown
    ? []
    : [
        ...(directAnswer
          ? [{ key: 'direct-answer', label: t('companyResearch.report.sections.direct_answer') }]
          : []),
        ...additionalSections.map((section) => ({
          key: section.key,
          label: t(`companyResearch.report.sections.${section.key}`, {
            defaultValue: humanizeReportKey(section.key),
          }),
        })),
        ...agentResults.map((result, index) => ({
          key: `agent-${index}`,
          label: result.agentName,
        })),
      ];
  const tocSignature = tocItems.map((item) => item.key).join('|');
  const [activeTocKey, setActiveTocKey] = useState<string>();
  const manuallySelectedTocKey = useRef<string>();
  const tocRef = useRef<HTMLElement>(null);
  const activeTocLinkRef = useRef<HTMLAnchorElement>(null);
  const activeTocItemKey = tocItems.some((item) => item.key === activeTocKey)
    ? activeTocKey
    : tocItems[0]?.key;
  const sharePayload =
    task && report
      ? mapCompanyResearchReportToSharePayload(
          task,
          report,
          {
            productName: t('header.brand'),
            slogan: t('share.slogan'),
            researchType: t('companyResearch.result.researchType'),
            conclusion: t('companyResearch.report.sections.overall_conclusion'),
            judgments: t('share.poster.keyJudgments'),
            decision: t('companyResearch.conclusion.decision'),
            confidence: t('companyResearch.conclusion.confidence'),
            companyQuality: t('companyResearch.conclusion.companyQuality'),
            valuationStatus: t('companyResearch.conclusion.valuationStatus'),
            longTermOutlook: t('companyResearch.conclusion.longTermOutlook'),
            opportunity: t('companyResearch.conclusion.biggestOpportunity'),
            risk: t('companyResearch.report.sections.risks'),
            insufficientData: t('companyResearch.conclusion.insufficientData'),
            decisionLabels: {
              BUY: t('companyResearch.decision.BUY'),
              HOLD: t('companyResearch.decision.HOLD'),
              AVOID: t('companyResearch.decision.AVOID'),
              UNKNOWN: t('companyResearch.decision.UNKNOWN'),
            },
          },
          language,
        )
      : undefined;
  const bindStatus = searchParams.get('bind');
  const hasLoadedReport = Boolean(reportQuery.isSuccess && report);
  const hasHeaderActions =
    hasLoadedReport && Boolean(!userId || task?.isBound || bindStatus === 'success');

  useEffect(() => {
    if (!userId || !taskId || bindStatus !== 'pending' || bindingTaskIdRef.current === taskId) {
      return;
    }
    bindingTaskIdRef.current = taskId;
    bindMutation.mutate(
      { taskId, identityScope },
      {
        onSuccess: () => setSearchParams({ bind: 'success' }, { replace: true }),
        onError: () => setSearchParams({ bind: 'error' }, { replace: true }),
      },
    );
  }, [bindMutation, bindStatus, identityScope, setSearchParams, taskId, userId]);

  useEffect(() => {
    const tocKeys = tocSignature ? tocSignature.split('|') : [];
    if (!tocKeys.length || typeof IntersectionObserver === 'undefined') return undefined;

    const sections = tocKeys
      .map((key) => document.getElementById(`report-${key}`))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const manuallySelectedKey = manuallySelectedTocKey.current;
        if (manuallySelectedKey) {
          const selectedSection = document.getElementById(`report-${manuallySelectedKey}`);
          const selectedBounds = selectedSection?.getBoundingClientRect();
          if (
            selectedBounds &&
            selectedBounds.bottom > 96 &&
            selectedBounds.top < window.innerHeight
          ) {
            return;
          }
          manuallySelectedTocKey.current = undefined;
        }
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible) setActiveTocKey(visible.target.id.replace(/^report-/, ''));
      },
      { rootMargin: '-96px 0px -68% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [taskId, tocSignature]);

  useEffect(() => {
    const toc = tocRef.current;
    const activeTocLink = activeTocLinkRef.current;
    if (!toc || !activeTocLink) return;
    keepTocItemVisible(toc, activeTocLink);
  }, [activeTocItemKey]);

  async function handleRetry() {
    await Promise.all([taskQuery.refetch(), reportQuery.refetch()]);
  }

  return (
    <AppShell
      className={styles.page}
      mobileBack={{ to: newResearchPath, label: t('companyResearch.result.back') }}
    >
      <main ref={mainRef} className={styles.main} tabIndex={-1}>
        <Link className={styles.back} to={newResearchPath}>
          <ArrowLeft size={16} aria-hidden />
          {t('companyResearch.result.back')}
        </Link>
        {task && hasHeaderActions ? (
          <header className={styles.header}>
            <div className={styles.headerActions}>
              {!userId ? (
                <button
                  type="button"
                  className={styles.detailLink}
                  onClick={() =>
                    openLogin(() => setSearchParams({ bind: 'pending' }, { replace: true }))
                  }
                >
                  <Bookmark size={16} aria-hidden />
                  {t('companyResearch.result.saveAfterLogin')}
                </button>
              ) : null}
              {task.isBound || bindStatus === 'success' ? (
                <span className={styles.savedStatus}>{t('companyResearch.result.saved')}</span>
              ) : null}
            </div>
          </header>
        ) : null}

        {!taskId ? (
          <PageState
            icon={<AlertCircle size={22} />}
            title={t('companyResearch.common.missingTask')}
            description={t('companyResearch.common.missingTaskDescription')}
          />
        ) : taskQuery.isPending ? (
          <PageState
            icon={<Loader2 size={22} className={styles.spin} />}
            title={t('companyResearch.result.loadingTask')}
            description={t('companyResearch.result.loadingDescription')}
          />
        ) : taskQuery.isError || !task ? (
          <PageState
            icon={<AlertCircle size={22} />}
            title={t('companyResearch.common.loadError')}
            description={t('companyResearch.common.loadErrorDescription')}
            action={
              <button
                className={styles.primaryAction}
                type="button"
                onClick={() => void taskQuery.refetch()}
              >
                <RefreshCw size={16} aria-hidden />
                {t('companyResearch.common.retry')}
              </button>
            }
          />
        ) : task.status !== 'completed' && task.status !== 'partial' ? (
          <PageState
            icon={<FileText size={22} />}
            title={t('companyResearch.result.notReady')}
            description={t('companyResearch.result.notReadyDescription')}
            action={
              <Link className={styles.primaryAction} to={progressPath}>
                {t('companyResearch.result.viewProgress')}
              </Link>
            }
          />
        ) : !task.reportReady ? (
          <PageState
            icon={<FileText size={22} />}
            title={
              task.status === 'partial'
                ? t('companyResearch.result.partialUnavailableTitle')
                : t('companyResearch.result.reportError')
            }
            description={
              task.status === 'partial'
                ? t('companyResearch.result.partialUnavailableDescription')
                : t('companyResearch.result.reportErrorDescription')
            }
            action={
              <button
                className={styles.primaryAction}
                type="button"
                onClick={() => void taskQuery.refetch()}
              >
                <RefreshCw size={16} aria-hidden />
                {t('companyResearch.common.retry')}
              </button>
            }
          />
        ) : reportQuery.isPending ? (
          <PageState
            icon={<Loader2 size={22} className={styles.spin} />}
            title={t('companyResearch.result.loadingReport')}
            description={t('companyResearch.result.loadingDescription')}
          />
        ) : reportQuery.isError || !report ? (
          <PageState
            icon={<AlertCircle size={22} />}
            title={
              task.status === 'partial'
                ? t('companyResearch.result.partialUnavailableTitle')
                : t('companyResearch.result.reportError')
            }
            description={
              task.status === 'partial'
                ? t('companyResearch.result.partialUnavailableDescription')
                : t('companyResearch.result.reportErrorDescription')
            }
            action={
              <button
                className={styles.primaryAction}
                type="button"
                onClick={() => void handleRetry()}
              >
                <RefreshCw size={16} aria-hidden />
                {t('companyResearch.common.retry')}
              </button>
            }
          />
        ) : (
          <div className={styles.content}>
            {bindStatus === 'error' ? (
              <aside className={styles.partialNotice} role="alert">
                <strong>{t('companyResearch.result.bindErrorTitle')}</strong>
                <p>{t('companyResearch.result.bindErrorDescription')}</p>
              </aside>
            ) : null}
            {task.status === 'partial' ? (
              <aside className={styles.partialNotice}>
                <strong>{t('companyResearch.result.partialTitle')}</strong>
                <p>
                  {task.failReason
                    ? translateApiMessage(task.failReason)
                    : t('companyResearch.result.partialDescription')}
                </p>
                <ul>
                  {task.capabilities
                    .filter((item) => item.status === 'failed')
                    .map((item) => (
                      <li key={item.name}>{item.displayName || item.name}</li>
                    ))}
                </ul>
              </aside>
            ) : null}

            <div className={styles.reportSnapshot}>
              <section
                className={styles.companyCard}
                aria-labelledby="company-information company-name"
              >
                <div className={styles.snapshotHeading}>
                  <span className={styles.snapshotIcon} aria-hidden>
                    <Building2 size={20} strokeWidth={1.8} />
                  </span>
                  <div className={styles.snapshotTitle}>
                    <span>{t('companyResearch.result.eyebrow')}</span>
                    <h1 id="company-name">{title}</h1>
                  </div>
                </div>
                <h2 className={styles.companyInformation} id="company-information">
                  {t('companyResearch.result.companyInformation')}
                </h2>
                <dl className={styles.infoGrid}>
                  {companyFields.map(([key, value]) => (
                    <div data-company-field={key} key={key}>
                      <dt>{t(`companyResearch.fields.${key}`)}</dt>
                      <dd>
                        {key === 'objectType' || key === 'market'
                          ? t(
                              `${key === 'objectType' ? 'research.objectType' : 'market'}.${value}`,
                              {
                                defaultValue: value,
                              },
                            )
                          : value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className={styles.conclusionCard} aria-labelledby="overall-conclusion">
                <div className={styles.snapshotHeading}>
                  <span className={styles.snapshotIcon} aria-hidden>
                    <ShieldCheck size={20} strokeWidth={1.8} />
                  </span>
                  <h2 className={styles.sectionTitle} id="overall-conclusion">
                    {t('companyResearch.report.sections.overall_conclusion')}
                  </h2>
                  <div className={styles.snapshotActions}>
                    {sharePayload ? (
                      <button
                        className={styles.shareButton}
                        type="button"
                        onClick={() => setShareOpen(true)}
                      >
                        <Share2 size={16} aria-hidden />
                        {t('share.open')}
                      </button>
                    ) : null}
                  </div>
                </div>
                <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
                  <div className={styles.conclusionLayout}>
                    <div className={styles.conclusionPrimary}>
                      <div className={styles.conclusionDecision}>
                        <span className={styles.conclusionFieldLabel}>
                          {t('companyResearch.conclusion.decision')}
                        </span>
                        <strong className={styles.conclusionDecisionValue}>
                          {t(
                            `companyResearch.decision.${decisionField?.value.toUpperCase() ?? 'UNKNOWN'}`,
                            {
                              defaultValue: t('companyResearch.decision.UNKNOWN'),
                            },
                          )}
                        </strong>
                      </div>
                      <div className={styles.conclusionConfidence}>
                        <span className={styles.conclusionConfidenceDot} aria-hidden />
                        <span>{t('companyResearch.conclusion.confidence')}</span>
                        <strong>
                          {confidenceField
                            ? getConclusionDisplayValue(confidenceField, t)
                            : insufficientDataLabel}
                        </strong>
                      </div>
                      {conclusionSummary ? (
                        <ConclusionTextTooltip
                          className={styles.conclusionSummary}
                          value={conclusionSummary}
                        />
                      ) : null}
                    </div>

                    <div className={styles.conclusionDetails}>
                      <dl className={styles.conclusionMetrics}>
                        {conclusionMetricFields.map((field) => (
                          <div data-conclusion-field={field.reportKey} key={field.reportKey}>
                            <dt>{t(`companyResearch.conclusion.${field.labelKey}`)}</dt>
                            <dd>{getConclusionDisplayValue(field, t)}</dd>
                          </div>
                        ))}
                      </dl>
                      <dl className={styles.conclusionSignals}>
                        {conclusionSignalFields.map((field) => (
                          <div data-conclusion-field={field.reportKey} key={field.reportKey}>
                            <dt>
                              <span className={styles.conclusionSignalIcon} aria-hidden>
                                {field.reportKey === 'biggestRisk' ? (
                                  <TriangleAlert size={22} strokeWidth={1.8} />
                                ) : (
                                  <TrendingUp size={22} strokeWidth={1.8} />
                                )}
                              </span>
                              {t(`companyResearch.conclusion.${field.labelKey}`)}
                            </dt>
                            <dd>
                              <ConclusionTextTooltip
                                className={styles.conclusionSignalValue}
                                value={getConclusionDisplayValue(field, t)}
                              />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                </Tooltip.Provider>
              </section>
            </div>

            {tocItems.length ? (
              <nav ref={tocRef} className={styles.toc} aria-label={t('companyResearch.result.toc')}>
                <strong>{t('companyResearch.result.toc')}</strong>
                <div>
                  {tocItems.map((item) => (
                    <a
                      key={item.key}
                      ref={activeTocItemKey === item.key ? activeTocLinkRef : undefined}
                      href={`#report-${item.key}`}
                      aria-current={activeTocItemKey === item.key ? 'location' : undefined}
                      onClick={() => {
                        manuallySelectedTocKey.current = item.key;
                        setActiveTocKey(item.key);
                      }}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </nav>
            ) : null}

            <article
              className={styles.reportDocument}
              aria-label={t('companyResearch.result.toc')}
              data-dynamic-outline={Boolean(reportMarkdown)}
            >
              {reportMarkdown ? (
                <section className={styles.section} aria-labelledby="report-full-report">
                  <h2 className={styles.sectionTitle} id="report-full-report">
                    {t('companyResearch.result.fullReport')}
                  </h2>
                  <MarkdownContent
                    anchorPrefix="research-report"
                    content={reportMarkdown}
                    outlineLayout="rail"
                  />
                </section>
              ) : directAnswer ? (
                <section className={styles.section} aria-labelledby="report-direct-answer">
                  <h2 className={styles.sectionTitle} id="report-direct-answer">
                    {t('companyResearch.report.sections.direct_answer')}
                  </h2>
                  <p className={styles.lead}>{directAnswer}</p>
                </section>
              ) : (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    {t('companyResearch.report.sections.direct_answer')}
                  </h2>
                  <p className={styles.missing}>{t('companyResearch.result.missingSection')}</p>
                </section>
              )}
              {!reportMarkdown && capabilitySummary ? (
                <section className={styles.section} aria-labelledby="report-capability-summary">
                  <h2 className={styles.sectionTitle} id="report-capability-summary">
                    {t('companyResearch.result.capabilitySummary')}
                  </h2>
                  <StructuredReportValue value={capabilitySummary} />
                </section>
              ) : null}
              {!reportMarkdown &&
                additionalSections.map((section) => (
                  <section
                    className={styles.section}
                    aria-labelledby={`report-${section.key}`}
                    key={section.key}
                  >
                    <h2 className={styles.sectionTitle} id={`report-${section.key}`}>
                      {t(`companyResearch.report.sections.${section.key}`, {
                        defaultValue: humanizeReportKey(section.key),
                      })}
                    </h2>
                    <StructuredReportValue value={section.value} />
                  </section>
                ))}
              {!reportMarkdown &&
                agentResults.map((result, index) => (
                  <section
                    className={styles.section}
                    aria-labelledby={`report-agent-${index}`}
                    key={`${result.agentName}-${index}`}
                  >
                    <h2 className={styles.sectionTitle} id={`report-agent-${index}`}>
                      {result.agentName}
                    </h2>
                    {getCompanyResearchAgentResultMarkdown(result, language) ? (
                      <MarkdownContent
                        content={getCompanyResearchAgentResultMarkdown(result, language) ?? ''}
                      />
                    ) : null}
                    {isCompanyResearchSummaryAgentName(result.agentName) &&
                    result.normalizedOutput !== undefined ? (
                      <StructuredReportValue value={result.normalizedOutput} />
                    ) : null}
                  </section>
                ))}
            </article>
            <div className={styles.reportReferences}>
              <AgentReportReferences
                capabilities={task.capabilities}
                taskId={taskId}
                returnTo={resultPath}
              />
            </div>
          </div>
        )}
      </main>
      <BackToTop label={t('companyResearch.result.backToTop')} targetRef={mainRef} />
      <ShareDialog open={shareOpen} payload={sharePayload} onOpenChange={setShareOpen} />
    </AppShell>
  );
}
