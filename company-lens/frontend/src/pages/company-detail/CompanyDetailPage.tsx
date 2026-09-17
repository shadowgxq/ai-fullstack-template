import { AlertCircle, ArrowLeft, Building2, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  getCompanyResearchAdditionalSections,
  getCompanyResearchAgentResults,
  getCompanyResearchAgentResultMarkdown,
  getCompanyResearchDirectAnswer,
  getCompanyResearchOverallConclusion,
  getLocalizedCompanyResearchIndustry,
  humanizeReportKey,
  StructuredReportValue,
  useCompanyResearchReport,
  useCompanyResearchTask,
} from '../../entities/company-research';
import { ShareDialog } from '../../features/share';
import { toApiLanguage } from '../../shared/api';
import { MarkdownContent } from '../../shared/ui/MarkdownContent';
import { PageState } from '../../shared/ui/PageState';
import { AppShell } from '../../widgets/app-shell';
import { mapCompanyTaskToSharePayload } from './model/company-share.mapper';
import styles from './CompanyDetailPage.module.css';

export function CompanyDetailPage() {
  const { t, i18n } = useTranslation();
  const language = toApiLanguage(i18n.resolvedLanguage ?? i18n.language);
  const { projectId: routeTaskId, companyId: routeCompanySlug } = useParams<{
    projectId: string;
    companyId: string;
  }>();
  const taskId = routeTaskId?.trim() ?? '';
  const companySlug = routeCompanySlug?.trim() ?? '';
  const taskQuery = useCompanyResearchTask(taskId || undefined, undefined, {
    includeMessages: false,
  });
  const task = taskQuery.data;
  const reportQuery = useCompanyResearchReport(task);
  const report = reportQuery.data?.report;
  const [shareOpen, setShareOpen] = useState(false);
  const resultPath = taskId ? `/research/${encodeURIComponent(taskId)}/result` : '/research/new';
  const title = task?.companyName || task?.objectName || t('companyResearch.company.title');
  const industry = task
    ? getLocalizedCompanyResearchIndustry(language, task.industryZh, task.industryEn, task.industry)
    : undefined;
  const overallConclusion = report ? getCompanyResearchOverallConclusion(report) : undefined;
  const directAnswer = report ? getCompanyResearchDirectAnswer(report, language) : undefined;
  const agentResults = report ? getCompanyResearchAgentResults(report) : [];
  const additionalSections = report ? getCompanyResearchAdditionalSections(report) : [];
  const sharePayload =
    task && report
      ? mapCompanyTaskToSharePayload(
          task,
          report,
          {
            productName: t('header.brand'),
            slogan: t('share.slogan'),
            researchType: t('companyResearch.company.researchType'),
            risk: t('companyResearch.report.sections.risks'),
          },
          language,
        )
      : undefined;
  const metadata = [task?.stockCode, task?.market, industry, task?.objectRelation].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <AppShell
      className={styles.page}
      mobileBack={{ to: resultPath, label: t('companyResearch.company.back') }}
    >
      <main className={styles.main}>
        <Link className={styles.back} to={resultPath}>
          <ArrowLeft size={16} aria-hidden />
          {t('companyResearch.company.back')}
        </Link>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t('companyResearch.company.eyebrow')}</span>
          <div className={styles.identity}>
            <span className={styles.identityIcon} aria-hidden>
              <Building2 size={22} />
            </span>
            <div>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.identifier}>
                {task?.stockCode || companySlug || t('companyResearch.company.missingCompany')}
              </p>
            </div>
          </div>
          {sharePayload ? (
            <button className={styles.shareButton} type="button" onClick={() => setShareOpen(true)}>
              <Share2 size={16} aria-hidden />
              {t('share.open')}
            </button>
          ) : null}
        </header>

        {!taskId || !companySlug ? (
          <PageState
            icon={<AlertCircle size={22} />}
            title={t('companyResearch.company.missingCompany')}
            description={t('companyResearch.company.missingCompanyDescription')}
          />
        ) : taskQuery.isPending ? (
          <PageState
            icon={<Loader2 size={22} className={styles.spin} />}
            title={t('companyResearch.company.loading')}
            description={t('companyResearch.company.loadingDescription')}
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
            icon={<Building2 size={22} />}
            title={t('companyResearch.result.notReady')}
            description={t('companyResearch.result.notReadyDescription')}
            action={
              <Link className={styles.primaryAction} to={resultPath}>
                {t('companyResearch.company.back')}
              </Link>
            }
          />
        ) : !task.reportReady ? (
          <PageState
            icon={<Building2 size={22} />}
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
            title={t('companyResearch.company.loadingReport')}
            description={t('companyResearch.company.loadingDescription')}
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
                onClick={() => void reportQuery.refetch()}
              >
                <RefreshCw size={16} aria-hidden />
                {t('companyResearch.common.retry')}
              </button>
            }
          />
        ) : (
          <div className={styles.body}>
            <section className={styles.section} aria-labelledby="company-metadata-title">
              <h2 id="company-metadata-title" className={styles.sectionTitle}>
                {t('companyResearch.company.basicInfo')}
              </h2>
              {metadata.length ? (
                <div className={styles.metadata}>
                  {metadata.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyBody}>{t('companyResearch.company.basicInfoPending')}</p>
              )}
            </section>

            {overallConclusion !== undefined ? (
              <section
                className={styles.heroConclusion}
                aria-labelledby="company-overall-conclusion"
              >
                <h2 id="company-overall-conclusion" className={styles.sectionTitle}>
                  {t('companyResearch.report.sections.overall_conclusion')}
                </h2>
                <StructuredReportValue value={overallConclusion} />
              </section>
            ) : null}

            {directAnswer ? (
              <section className={styles.section} aria-labelledby="company-direct-answer">
                <h2 id="company-direct-answer" className={styles.sectionTitle}>
                  {t('companyResearch.report.sections.direct_answer')}
                </h2>
                <p className={styles.paragraph}>{directAnswer}</p>
              </section>
            ) : null}

            {agentResults.map((agentResult, index) => (
              <section
                className={styles.section}
                aria-labelledby={`company-agent-${index}`}
                key={agentResult.agentName}
              >
                <h2 id={`company-agent-${index}`} className={styles.sectionTitle}>
                  {task.capabilities.find((item) => item.name === agentResult.agentName)
                    ?.displayName || humanizeReportKey(agentResult.agentName)}
                </h2>
                {getCompanyResearchAgentResultMarkdown(agentResult, language) ? (
                  <MarkdownContent
                    anchorPrefix={`company-${agentResult.agentName}`}
                    content={getCompanyResearchAgentResultMarkdown(agentResult, language) ?? ''}
                    outlineLayout="rail"
                  />
                ) : null}
                {agentResult.normalizedOutput !== undefined ? (
                  <details className={styles.normalizedDetails}>
                    <summary>{t('companyResearch.result.normalizedOutput')}</summary>
                    <StructuredReportValue value={agentResult.normalizedOutput} />
                  </details>
                ) : null}
              </section>
            ))}

            {additionalSections.map((section) => (
              <section
                className={styles.section}
                aria-labelledby={`company-${section.key}`}
                key={section.key}
              >
                <h2 id={`company-${section.key}`} className={styles.sectionTitle}>
                  {t(`companyResearch.report.sections.${section.key}`, {
                    defaultValue: humanizeReportKey(section.key),
                  })}
                </h2>
                <StructuredReportValue value={section.value} />
              </section>
            ))}
          </div>
        )}
      </main>
      <ShareDialog open={shareOpen} payload={sharePayload} onOpenChange={setShareOpen} />
    </AppShell>
  );
}
