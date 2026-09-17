import { AlertCircle, ArrowLeft, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  StructuredReportValue,
  getCompanyResearchSourceItems,
  getCompanyResearchAgentResultMarkdown,
  humanizeReportKey,
  isCompanyResearchSummaryAgentName,
  useCompanyResearchCapabilityResult,
  useCompanyResearchTask,
} from '../../entities/company-research';
import { BackToTop } from '../../shared/ui/BackToTop';
import { toApiLanguage } from '../../shared/api';
import { MarkdownContent } from '../../shared/ui/MarkdownContent';
import { PageState } from '../../shared/ui/PageState';
import { AppShell } from '../../widgets/app-shell';
import { getAgentReportReturnPath } from './model/agent-report-navigation';
import styles from './AgentReportPage.module.css';

function getCapabilityLabelKey(
  name: string,
): 'fundamentals' | 'team' | 'management' | 'synthesis' | undefined {
  const normalizedName = name
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  if (normalizedName.includes('management')) return 'management';
  if (normalizedName.includes('team')) return 'team';
  if (normalizedName.includes('synthesis')) return 'synthesis';
  if (normalizedName.includes('investment_research')) return 'fundamentals';
  return undefined;
}

export function AgentReportPage() {
  const { t, i18n } = useTranslation();
  const language = toApiLanguage(i18n.resolvedLanguage ?? i18n.language);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { projectId: routeTaskId, agentId: routeCapability } = useParams<{
    projectId: string;
    agentId: string;
  }>();
  const taskId = routeTaskId?.trim() ?? '';
  const capabilityName = routeCapability?.trim() ?? '';
  const taskQuery = useCompanyResearchTask(taskId || undefined, undefined, {
    includeMessages: false,
  });
  const task = taskQuery.data;
  const capability = task?.capabilities.find((item) => item.name === capabilityName);
  const capabilityLabelKey = getCapabilityLabelKey(capabilityName);
  const agentDisplayName =
    (capabilityLabelKey
      ? t(`companyResearch.capabilities.${capabilityLabelKey}`)
      : capability?.displayName?.trim()) ||
    (capabilityName ? humanizeReportKey(capabilityName.replace(/_agent$/, '')) : undefined);
  const capabilityResultQuery = useCompanyResearchCapabilityResult(task, capabilityName);
  const agentResult = capabilityResultQuery.data;
  const progressPath = taskId
    ? `/research/${encodeURIComponent(taskId)}/progress`
    : '/research/new';
  const resultPath = taskId ? `/research/${encodeURIComponent(taskId)}/result` : progressPath;
  const backPath = getAgentReportReturnPath(location.state, resultPath);
  const canLoadReport = capability?.status === 'succeeded';
  const normalizedOutput =
    agentResult && isCompanyResearchSummaryAgentName(agentResult.agentName)
      ? agentResult.normalizedOutput
      : undefined;
  const reportMarkdown = agentResult
    ? getCompanyResearchAgentResultMarkdown(agentResult, language)
    : undefined;
  const sourceItems = getCompanyResearchSourceItems(agentResult?.sources);

  return (
    <AppShell
      className={styles.page}
      mobileBack={{ to: backPath, label: t('companyResearch.agent.back') }}
    >
      <main ref={mainRef} className={styles.main} tabIndex={-1}>
        <Link className={styles.back} to={backPath}>
          <ArrowLeft size={16} aria-hidden />
          {t('companyResearch.agent.back')}
        </Link>
        <header className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.identityIcon} aria-hidden>
              <FileText size={24} />
            </span>
            <div className={styles.identityCopy}>
              <h1 className={styles.title}>
                {agentDisplayName
                  ? t('research.agentReport.titleTemplate', { agentName: agentDisplayName })
                  : t('companyResearch.agent.eyebrow')}
              </h1>
            </div>
          </div>
        </header>
        <div className={styles.pageColumn}>
          {!taskId || !capabilityName ? (
            <PageState
              icon={<AlertCircle size={22} />}
              title={t('companyResearch.agent.missingCapability')}
              description={t('companyResearch.agent.missingCapabilityDescription')}
            />
          ) : taskQuery.isPending ? (
            <PageState
              icon={<Loader2 size={22} className={styles.spin} />}
              title={t('companyResearch.agent.loading')}
              description={t('companyResearch.agent.loadingDescription')}
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
          ) : !capability ? (
            <PageState
              icon={<AlertCircle size={22} />}
              title={t('companyResearch.agent.notFound')}
              description={t('companyResearch.agent.notFoundDescription')}
              action={
                <Link className={styles.primaryAction} to={progressPath}>
                  {t('companyResearch.agent.progressBack')}
                </Link>
              }
            />
          ) : !canLoadReport ? (
            <PageState
              icon={<FileText size={22} />}
              title={t('companyResearch.agent.notReady')}
              description={t('companyResearch.agent.notReadyDescription')}
              action={
                <Link className={styles.primaryAction} to={progressPath}>
                  {t('companyResearch.agent.progressBack')}
                </Link>
              }
            />
          ) : capabilityResultQuery.isPending ? (
            <PageState
              icon={<Loader2 size={22} className={styles.spin} />}
              title={t('companyResearch.agent.loadingReport')}
              description={t('companyResearch.agent.loadingReportDescription')}
            />
          ) : capabilityResultQuery.isError ? (
            <PageState
              icon={<AlertCircle size={22} />}
              title={t('companyResearch.agent.reportUnavailable')}
              description={t('companyResearch.agent.reportUnavailableDescription')}
              action={
                <button
                  className={styles.primaryAction}
                  type="button"
                  onClick={() => void capabilityResultQuery.refetch()}
                >
                  <RefreshCw size={16} aria-hidden />
                  {t('companyResearch.common.retry')}
                </button>
              }
            />
          ) : !agentResult ? (
            <PageState
              icon={<AlertCircle size={22} />}
              title={t('companyResearch.agent.resultMissing')}
              description={t('companyResearch.agent.resultMissingDescription')}
              action={
                <Link className={styles.primaryAction} to={resultPath}>
                  {t('companyResearch.agent.back')}
                </Link>
              }
            />
          ) : !agentResult.reportReady ? (
            <PageState
              icon={<FileText size={22} />}
              title={t('companyResearch.agent.reportUnavailable')}
              description={t('companyResearch.agent.reportUnavailableDescription')}
              action={
                <button
                  className={styles.primaryAction}
                  type="button"
                  onClick={() => void capabilityResultQuery.refetch()}
                >
                  <RefreshCw size={16} aria-hidden />
                  {t('companyResearch.common.retry')}
                </button>
              }
            />
          ) : (
            <>
              <div className={styles.body}>
                {reportMarkdown ? (
                  <section className={styles.section} aria-labelledby="agent-report-content">
                    <div className={styles.sectionHeading}>
                      <span className={styles.sectionEyebrow}>
                        {t('companyResearch.agent.markdownEyebrow')}
                      </span>
                      <h2 className={styles.sectionTitle} id="agent-report-content">
                        {t('companyResearch.agent.markdownTitle')}
                      </h2>
                    </div>
                    <article className={styles.reportBlock}>
                      <MarkdownContent
                        anchorPrefix={`agent-${agentResult.agentName}`}
                        content={reportMarkdown}
                        outlineLayout="rail"
                        outlineVariant="agent-report"
                      />
                    </article>
                  </section>
                ) : null}
                {normalizedOutput !== undefined ? (
                  <section className={styles.section} aria-labelledby="agent-normalized-output">
                    <div className={styles.sectionHeading}>
                      <span className={styles.sectionEyebrow}>
                        {t('companyResearch.agent.structuredEyebrow')}
                      </span>
                      <h2 className={styles.sectionTitle} id="agent-normalized-output">
                        {t('companyResearch.agent.structuredTitle')}
                      </h2>
                    </div>
                    <StructuredReportValue value={normalizedOutput} />
                  </section>
                ) : null}
                {sourceItems.length > 0 ? (
                  <section className={styles.section} aria-labelledby="agent-sources">
                    <div className={styles.sectionHeading}>
                      <span className={styles.sectionEyebrow}>
                        {t('companyResearch.agent.sourcesEyebrow')}
                      </span>
                      <h2 className={styles.sectionTitle} id="agent-sources">
                        {t('companyResearch.agent.sourcesTitle')}
                      </h2>
                    </div>
                    <ul className={styles.sourceList}>
                      {sourceItems.map((source, index) => (
                        <li
                          className={styles.sourceItem}
                          key={`${source.url ?? source.label}-${index}`}
                        >
                          {source.url ? (
                            <a
                              className={styles.sourceLink}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span className={styles.sourceLinkLabel}>{source.label}</span>
                              <ExternalLink size={14} aria-hidden />
                            </a>
                          ) : (
                            <strong>{source.label}</strong>
                          )}
                          {source.detail ? (
                            <span className={styles.sourceContent}>{source.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {!reportMarkdown &&
                normalizedOutput === undefined &&
                sourceItems.length === 0 ? (
                  <p className={styles.emptyBody}>{t('companyResearch.agent.emptyResult')}</p>
                ) : null}
              </div>
              <BackToTop label={t('research.agentReport.backToTop')} targetRef={mainRef} />
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
