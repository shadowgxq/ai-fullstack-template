import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  useCompanyResearchEvents,
  getCompanyResearchIdentityScope,
  getLocalizedCompanyResearchIndustry,
  useCompanyResearchTask,
  useRetryCompanyResearchCapability,
  useRetryCompanyResearchReport,
  type CompanyResearchCapability,
  type CompanyResearchTask,
  type CompanyResearchTaskStatus,
} from '../../entities/company-research';
import { useAuthStore } from '../../features/auth';
import { getApiErrorMessage, toApiLanguage, translateApiMessage } from '../../shared/api';
import { canRetryFinalReport, getRetryReportAgentStates } from '../../shared/research/retry-report';
import { PageState } from '../../shared/ui/PageState';
import { AppShell } from '../../widgets/app-shell';
import {
  findCompanyResearchAgent,
  getCompanyResearchThinkingSteps,
  getCompanyResearchThinkingStepSummary,
  normalizeResearchAgentName,
} from './model/research-progress-thinking';
import {
  getDisplayedResearchProgress,
  getFixedFailedResearchProgress,
  getFakeResearchProgress,
  getReportRetryResearchProgress,
} from './model/research-progress-timing';
import {
  clearResearchProgressRecord,
  getOrCreateResearchProgressRecord,
  persistResearchProgressRecord,
  RESEARCH_PROGRESS_REPORT_RETRY_PHASE,
  RESEARCH_PROGRESS_RETRY_BASELINE,
  resetResearchProgressRecord,
} from './model/research-progress-storage';
import { CompanyResearchThinkingTrail } from './ui/CompanyResearchThinkingTrail';
import styles from './ResearchProgressPage.module.css';

function StatusIcon({ status }: { status: CompanyResearchTaskStatus }) {
  if (status === 'completed' || status === 'partial') return <CheckCircle2 size={20} />;
  if (status === 'failed' || status === 'cancelled') return <XCircle size={20} />;
  if (status === 'pending') return <Clock3 size={20} />;
  if (status === 'unknown') return <AlertCircle size={20} />;
  return <Loader2 size={20} className={styles.spin} />;
}

type ReferenceIconName =
  | 'activity'
  | 'building'
  | 'chevron-down'
  | 'clock'
  | 'shield-person'
  | 'team'
  | 'users';

function ReferenceIcon({ name }: { name: ReferenceIconName }) {
  const iconProps = {
    className: styles.referenceIcon,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  switch (name) {
    case 'activity':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 12h3l2-5 2.5 10 1.8-5H18" />
        </svg>
      );
    case 'building':
      return (
        <svg {...iconProps}>
          <path d="M4 21V6a2 2 0 0 1 2-2h8v17M14 9h4a2 2 0 0 1 2 2v10M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M3 21h18" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...iconProps}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'shield-person':
      return (
        <svg {...iconProps}>
          <path d="M12 3 19 6v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6l7-3Z" />
          <circle cx="12" cy="10" r="2.2" />
          <path d="M8.8 16a3.4 3.4 0 0 1 6.4 0" />
        </svg>
      );
    case 'team':
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20v-1.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5V20M15 14.2a4.5 4.5 0 0 1 6 4.3V20" />
        </svg>
      );
    case 'users':
      return (
        <svg {...iconProps}>
          <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
          <circle cx="9.5" cy="7" r="3" />
          <path d="M17 11a3 3 0 1 0 0-6M21 20v-1.5a4 4 0 0 0-3-3.7" />
        </svg>
      );
  }
}

type CapabilityRole = 'fundamentals' | 'team' | 'management' | 'synthesis';

function getCapabilityRole(name: string): CapabilityRole {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('team')) return 'team';
  if (normalizedName.includes('management')) return 'management';
  if (normalizedName.includes('synthesis')) return 'synthesis';
  return 'fundamentals';
}

function CapabilityRoleIcon({ role }: { role: CapabilityRole }) {
  if (role === 'team') return <ReferenceIcon name="team" />;
  if (role === 'management') return <ReferenceIcon name="shield-person" />;
  if (role === 'synthesis') return <ReferenceIcon name="activity" />;
  return <ReferenceIcon name="building" />;
}

function getCapabilityLabelKey(name: string): string {
  if (name.includes('management')) return 'management';
  if (name.includes('team')) return 'team';
  if (name.includes('synthesis')) return 'synthesis';
  return 'fundamentals';
}

const COMPANY_RESEARCH_ACTIVE_TASK_STATUSES: readonly CompanyResearchTaskStatus[] = [
  'pending',
  'resolving',
  'collecting',
  'analyzing',
  'synthesizing',
];

type ReportRetryProgressMode = 'idle' | 'accepted' | 'running';

const RESEARCH_ERROR_TOAST_DURATION_MS = 3200;

function ResearchErrorToast({ message, toastKey }: { message: string; toastKey: number }) {
  const [dismissedToastKey, setDismissedToastKey] = useState<number>();

  useEffect(() => {
    if (!message || !toastKey) {
      return undefined;
    }

    const timer = globalThis.setTimeout(
      () => setDismissedToastKey(toastKey),
      RESEARCH_ERROR_TOAST_DURATION_MS,
    );
    return () => globalThis.clearTimeout(timer);
  }, [message, toastKey]);

  if (!message || dismissedToastKey === toastKey) {
    return null;
  }

  const toast = (
    <div className={styles.errorToast} role="alert" aria-live="assertive" aria-atomic="true">
      <AlertCircle size={17} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) {
    return toast;
  }
  return createPortal(toast, document.body);
}

function mergeTaskCapabilities(task: CompanyResearchTask): readonly CompanyResearchCapability[] {
  const agentsByName = new Map(
    (task.agents ?? []).map((agent) => [normalizeResearchAgentName(agent.agentName), agent]),
  );
  const knownNames = new Set<string>();
  const capabilities = task.capabilities.map((capability) => {
    const normalizedName = normalizeResearchAgentName(capability.name);
    const agent = agentsByName.get(normalizedName);
    knownNames.add(normalizedName);
    return agent
      ? {
          ...capability,
          displayName: agent.displayName ?? capability.displayName,
          status: agent.status,
          ...(agent.retryable !== undefined ? { retryable: agent.retryable } : {}),
        }
      : capability;
  });
  const supplementalCapabilities = (task.agents ?? [])
    .filter((agent) => !knownNames.has(normalizeResearchAgentName(agent.agentName)))
    .map(({ agentName, displayName, status, retryable }) => ({
      name: agentName,
      displayName,
      status,
      ...(retryable !== undefined ? { retryable } : {}),
    }));
  return [...capabilities, ...supplementalCapabilities];
}

export function ResearchProgressPage() {
  const { t, i18n } = useTranslation();
  const language = toApiLanguage(i18n.resolvedLanguage ?? i18n.language);
  const { projectId: routeTaskId } = useParams<{ projectId: string }>();
  const taskId = routeTaskId?.trim() ?? '';
  const userId = useAuthStore((state) => state.user?.userId);
  const identityScope = getCompanyResearchIdentityScope(userId);
  const taskQuery = useCompanyResearchTask(taskId || undefined, identityScope, {
    includeMessages: true,
  });
  const retryMutation = useRetryCompanyResearchCapability();
  const retryReportMutation = useRetryCompanyResearchReport();
  const [expandedCapabilities, setExpandedCapabilities] = useState<ReadonlySet<string>>(new Set());
  const task = taskQuery.data;
  useCompanyResearchEvents(task, identityScope);
  const displayedCapabilities = task ? mergeTaskCapabilities(task) : [];
  const researchAgentCapabilities = getRetryReportAgentStates(undefined, displayedCapabilities);
  const isAnalysisInProgress = Boolean(
    task && COMPANY_RESEARCH_ACTIVE_TASK_STATUSES.includes(task.status),
  );
  const retryDisabledReason = isAnalysisInProgress
    ? t('companyResearch.progress.retryDisabledWhileRunning')
    : undefined;
  const isRetryDisabled = retryMutation.isPending || isAnalysisInProgress;
  const canRetryReport = Boolean(
    task &&
    canRetryFinalReport({
      status: task.status,
      agents: task.agents,
      capabilities: task.capabilities,
      finalResultAvailable: task.finalResultAvailable,
      synthesisFailed: task.synthesisFailed,
    }),
  );

  const [progressRecordRevision, setProgressRecordRevision] = useState(0);
  const progressRecord = useMemo(
    () => getOrCreateResearchProgressRecord(taskId),
    [progressRecordRevision, taskId],
  );
  const [progressSnapshot, setProgressSnapshot] = useState(() => ({
    taskId,
    value: progressRecord?.lastProgress ?? 0,
  }));
  const [reportRetryProgressMode, setReportRetryProgressMode] =
    useState<ReportRetryProgressMode>('idle');

  const resetProgressAfterReportRetry = () => {
    setReportRetryProgressMode('accepted');
    const record = resetResearchProgressRecord(taskId);
    setProgressSnapshot({ taskId, value: record?.lastProgress ?? 80 });
    setProgressRecordRevision((revision) => revision + 1);
  };

  useEffect(() => {
    setReportRetryProgressMode('idle');
  }, [taskId]);

  const trackedProgress =
    progressSnapshot.taskId === taskId
      ? progressSnapshot.value
      : (progressRecord?.lastProgress ?? 0);
  // The initial curve starts at 0; a report retry replaces it with the stored 80% baseline.
  const progressStartedAt = useMemo(
    () => progressRecord?.startedAt ?? Date.now(),
    [progressRecord, taskId],
  );
  const reportConfirmed = Boolean(
    task?.reportReady && (task.status === 'completed' || task.status === 'partial'),
  );
  const isTerminalFailure = Boolean(
    task && (task.status === 'failed' || task.status === 'cancelled'),
  );
  const isStoredReportRetryProgress = Boolean(
    task &&
      progressRecord?.phase === RESEARCH_PROGRESS_REPORT_RETRY_PHASE &&
      COMPANY_RESEARCH_ACTIVE_TASK_STATUSES.includes(task.status),
  );
  const isReportRetryProgressActive = Boolean(
    !reportConfirmed &&
      (reportRetryProgressMode !== 'idle' || isStoredReportRetryProgress),
  );
  const isTerminalFailureForProgress = isTerminalFailure && !isReportRetryProgressActive;

  useEffect(() => {
    if (reportConfirmed) {
      if (reportRetryProgressMode !== 'idle') setReportRetryProgressMode('idle');
      return;
    }

    if (
      reportRetryProgressMode === 'accepted' &&
      task &&
      COMPANY_RESEARCH_ACTIVE_TASK_STATUSES.includes(task.status)
    ) {
      setReportRetryProgressMode('running');
      return;
    }

    if (
      reportRetryProgressMode === 'accepted' &&
      task &&
      (task.status === 'completed' || task.status === 'partial')
    ) {
      setReportRetryProgressMode('idle');
      return;
    }

    if (
      reportRetryProgressMode === 'running' &&
      task &&
      !COMPANY_RESEARCH_ACTIVE_TASK_STATUSES.includes(task.status)
    ) {
      setReportRetryProgressMode('idle');
    }
  }, [reportConfirmed, reportRetryProgressMode, task?.status]);

  const hasFailedCapability = displayedCapabilities.some(
    (capability) => capability.status === 'failed',
  );
  const isProgressFrozen = Boolean(
    task &&
    !reportConfirmed &&
    (isTerminalFailureForProgress || task.status === 'partial' || hasFailedCapability),
  );
  const shouldAdvanceFakeProgress = Boolean(
    task &&
      !reportConfirmed &&
      (isReportRetryProgressActive || !isProgressFrozen),
  );
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!shouldAdvanceFakeProgress) return undefined;

    const updateClock = () => setClock(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [progressStartedAt, shouldAdvanceFakeProgress, taskId]);

  const title =
    task?.objectName || task?.companyName || task?.query || t('companyResearch.progress.title');
  const completedCount = researchAgentCapabilities.filter(
    (item) => item.status === 'succeeded',
  ).length;
  const capabilityCount = researchAgentCapabilities.length;
  const allCapabilitiesCompleted = capabilityCount > 0 && completedCount === capabilityCount;
  const canViewReport = Boolean(
    task?.reportReady && (task.status === 'completed' || task.status === 'partial'),
  );
  const timeProgress = getFakeResearchProgress(clock - progressStartedAt);
  const reportRetryProgress = getReportRetryResearchProgress(
    clock - progressStartedAt,
    RESEARCH_PROGRESS_RETRY_BASELINE,
  );
  const calculatedProgress = isReportRetryProgressActive
    ? reportRetryProgress
    : getDisplayedResearchProgress(timeProgress, task?.agents ?? [], reportConfirmed);
  // A terminal failure is a fixed Agent-completion checkpoint. Keep 100% for
  // the state in which the API confirms that the final report is available.
  const fixedFailedProgress = getFixedFailedResearchProgress(researchAgentCapabilities);
  const frozenProgress =
    isTerminalFailureForProgress && researchAgentCapabilities.length > 0
      ? fixedFailedProgress
      : trackedProgress;
  const overallProgress = reportConfirmed
    ? 100
    : isReportRetryProgressActive
      ? Math.max(RESEARCH_PROGRESS_RETRY_BASELINE, trackedProgress, reportRetryProgress)
      : isProgressFrozen
        ? frozenProgress
        : Math.max(trackedProgress, calculatedProgress);

  useEffect(() => {
    if (!taskId) return;
    if (reportConfirmed) {
      clearResearchProgressRecord(taskId);
      return;
    }
    if (!progressRecord) return;
    if (progressSnapshot.taskId !== taskId) {
      setProgressSnapshot({ taskId, value: progressRecord.lastProgress });
      return;
    }
    const nextProgress = isTerminalFailureForProgress
      ? overallProgress
      : Math.max(progressSnapshot.value, overallProgress);
    const nextStatus =
      isReportRetryProgressActive && isTerminalFailure
        ? 'collecting'
        : (task?.status ?? progressRecord.status);
    const nextPhase = isReportRetryProgressActive
      ? RESEARCH_PROGRESS_REPORT_RETRY_PHASE
      : undefined;
    const taskStatusChanged = progressRecord.status !== nextStatus;
    const progressPhaseChanged = progressRecord.phase !== nextPhase;
    // A terminal task can keep the same visible percentage. Persist its status anyway so a
    // refresh does not leave the progress cache looking like an active research run.
    if (nextProgress === progressSnapshot.value && !taskStatusChanged && !progressPhaseChanged) {
      return;
    }

    if (nextProgress !== progressSnapshot.value) {
      setProgressSnapshot({ taskId, value: nextProgress });
    }
    persistResearchProgressRecord(taskId, {
      ...progressRecord,
      lastProgress: nextProgress,
      status: nextStatus,
      phase: nextPhase,
    });
  }, [
    isReportRetryProgressActive,
    isTerminalFailure,
    isTerminalFailureForProgress,
    overallProgress,
    progressRecord,
    progressSnapshot,
    reportConfirmed,
    task?.status,
    taskId,
  ]);

  const isSummaryReportGenerating = Boolean(
    task &&
    !task.reportReady &&
    (isReportRetryProgressActive ||
      (task.status !== 'failed' &&
        (task.status === 'synthesizing' || allCapabilitiesCompleted))),
  );
  const shouldShowDurationHint =
    isReportRetryProgressActive ||
    task?.status === 'pending' ||
    task?.status === 'resolving' ||
    task?.status === 'collecting' ||
    task?.status === 'analyzing' ||
    task?.status === 'synthesizing';
  const translatedFailureReason = task?.failReason ? translateApiMessage(task.failReason) : '';
  const shouldShowFailureReason = Boolean(
    translatedFailureReason && translatedFailureReason !== t('apiErrors.generic'),
  );
  const shouldShowTaskFailureNotice = Boolean(
    task &&
      !isReportRetryProgressActive &&
      (task.status === 'partial' || (isTerminalFailure && shouldShowFailureReason)),
  );
  const headerMeta = task
    ? [task.stockCode, task.market].filter(Boolean).join(' · ') ||
      (task.query !== title ? task.query : '')
    : '';
  const metadata = task
    ? [
        ['object', task.query],
        ['objectType', task.objectType],
        ['company', task.companyName],
        ['stockCode', task.stockCode],
        ['market', task.market],
        ['exchange', task.exchange],
        [
          'industry',
          getLocalizedCompanyResearchIndustry(
            language,
            task.industryZh,
            task.industryEn,
            task.industry,
          ),
        ],
        ['keyPeople', task.keyPeople],
        ['relation', task.objectRelation],
        ['researchFocus', task.researchFocus],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];
  const currentStageStatus = isReportRetryProgressActive ? 'synthesizing' : task?.status;
  const currentStage = task
    ? t(`companyResearch.progress.currentStage.${currentStageStatus}`, {
        defaultValue: t(`companyResearch.taskStatus.${task.status}`),
      })
    : '';

  const toggleCapability = (capabilityName: string) => {
    setExpandedCapabilities((current) => {
      const next = new Set(current);
      if (next.has(capabilityName)) {
        next.delete(capabilityName);
      } else {
        next.add(capabilityName);
      }
      return next;
    });
  };

  return (
    <AppShell
      className={styles.page}
      mobileBack={{ to: '/research/new', label: t('research.progress.backToInput') }}
    >
      <main className={styles.main}>
        <Link className={styles.back} to="/research/new">
          <ArrowLeft size={16} aria-hidden />
          {t('research.progress.backToInput')}
        </Link>

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>{t('companyResearch.progress.eyebrow')}</span>
            <h1 className={styles.title}>{title}</h1>
            {headerMeta ? <p className={styles.query}>{headerMeta}</p> : null}
          </div>
          {task ? (
            <div className={styles.headerActions}>
              {canRetryReport || isReportRetryProgressActive ? (
                <button
                  className={styles.resultLink}
                  type="button"
                  disabled={retryReportMutation.isPending || isReportRetryProgressActive}
                  aria-busy={retryReportMutation.isPending || isReportRetryProgressActive}
                  onClick={() =>
                    retryReportMutation.mutate(
                      {
                        taskId,
                        identityScope,
                      },
                      { onSuccess: resetProgressAfterReportRetry },
                    )
                  }
                >
                  {retryReportMutation.isPending || isReportRetryProgressActive ? (
                    <Loader2 size={14} className={styles.spin} aria-hidden />
                  ) : (
                    <RotateCcw size={14} aria-hidden />
                  )}
                  {t(
                    retryReportMutation.isPending || isReportRetryProgressActive
                      ? 'companyResearch.progress.retryReportPending'
                      : 'companyResearch.progress.retryReport',
                  )}
                </button>
              ) : null}
              <div
                className={styles.taskStatus}
                data-status={task.status}
                role="status"
                aria-live="polite"
              >
                <StatusIcon status={task.status} />
                <span>{t(`companyResearch.taskStatus.${task.status}`)}</span>
              </div>
            </div>
          ) : null}
        </header>

        {!taskId ? (
          <PageState
            icon={<AlertCircle size={22} />}
            title={t('companyResearch.common.missingTask')}
            description={t('companyResearch.common.missingTaskDescription')}
          />
        ) : taskQuery.isPending ? (
          <PageState
            icon={<Loader2 size={22} className={styles.spin} />}
            title={t('companyResearch.progress.loading')}
            description={t('companyResearch.progress.loadingDescription')}
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
        ) : (
          <div className={styles.content}>
            <section className={styles.details} aria-labelledby="research-object-title">
              <h2 id="research-object-title" className={styles.sectionTitle}>
                {t('companyResearch.progress.objectDetails')}
              </h2>
              <dl className={styles.metadataGrid}>
                {metadata.map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(`companyResearch.fields.${key}`)}</dt>
                    <dd>
                      {key === 'objectType' || key === 'market'
                        ? t(`${key === 'objectType' ? 'research.objectType' : 'market'}.${value}`, {
                            defaultValue: value,
                          })
                        : value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section
              className={styles.overview}
              data-status={task.status}
              data-running={shouldAdvanceFakeProgress ? 'true' : undefined}
              aria-labelledby="progress-summary-title"
              aria-busy={shouldAdvanceFakeProgress}
            >
              <div className={styles.progressHeader}>
                <h2 id="progress-summary-title" className={styles.sectionTitle}>
                  {t('companyResearch.progress.overallProgress')}
                </h2>
                <span className={styles.researchPill} role="status" aria-live="polite">
                  {shouldAdvanceFakeProgress ? <Loader2 className={styles.spin} size={15} /> : null}
                  {reportConfirmed
                    ? t('companyResearch.progress.reportReady')
                    : isReportRetryProgressActive
                      ? t('companyResearch.progress.researching')
                      : task.status === 'failed' || task.status === 'cancelled'
                        ? t(`companyResearch.taskStatus.${task.status}`)
                        : t('companyResearch.progress.researching')}
                </span>
              </div>

              <strong className={styles.progressPercent}>{overallProgress}%</strong>
              <span
                className={styles.progressTrack}
                role="progressbar"
                aria-label={t('companyResearch.progress.overallProgress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallProgress}
                aria-valuetext={`${overallProgress}%`}
              >
                <span className={styles.progressFill} style={{ width: `${overallProgress}%` }} />
              </span>

              <div className={styles.progressMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon} aria-hidden="true">
                    <ReferenceIcon name="activity" />
                  </span>
                  <span className={styles.metaCopy}>
                    <span className={styles.metaLabel}>
                      {t('companyResearch.progress.currentStageLabel')}
                    </span>
                    <strong className={styles.metaValue}>{currentStage}</strong>
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon} aria-hidden="true">
                    <ReferenceIcon name="users" />
                  </span>
                  <span className={styles.metaCopy}>
                    <span className={styles.metaLabel}>
                      {t('companyResearch.progress.completedAgents')}
                    </span>
                    <strong className={styles.metaValue}>
                      {t('companyResearch.progress.completedAgentCount', {
                        completed: completedCount,
                        total: capabilityCount,
                      })}
                    </strong>
                  </span>
                </div>
              </div>

              {shouldShowDurationHint ? (
                <p className={styles.durationHint}>
                  <ReferenceIcon name="clock" />
                  <span>{t('companyResearch.progress.durationHint')}</span>
                </p>
              ) : null}
              {shouldShowTaskFailureNotice ? (
                <div className={styles.overviewBody}>
                  {task.status === 'partial' ? (
                    <p className={styles.partialNotice}>
                      {t('companyResearch.progress.partialNotice')}
                    </p>
                  ) : null}
                  {shouldShowFailureReason ? (
                    <p className={styles.failureReason}>{translatedFailureReason}</p>
                  ) : null}
                </div>
              ) : null}
            </section>

            {canViewReport ? (
              <div className={styles.resultActions}>
                <Link
                  className={styles.resultLink}
                  to={`/research/${encodeURIComponent(taskId)}/result`}
                >
                  {t('companyResearch.progress.viewReport')}
                  <ExternalLink size={14} aria-hidden />
                </Link>
              </div>
            ) : isSummaryReportGenerating ? (
              <div className={styles.resultActions}>
                <span className={styles.reportPending} role="status" aria-live="polite">
                  <Loader2 size={14} className={styles.spin} aria-hidden />
                  {t('companyResearch.progress.summaryReportGenerating')}
                </span>
              </div>
            ) : null}

            <section className={styles.agents} aria-labelledby="capabilities-title">
              <div className={styles.sectionHeader}>
                <div>
                  <h2 id="capabilities-title" className={styles.sectionTitle}>
                    {t('companyResearch.progress.agentSectionTitle')}
                  </h2>
                  <p className={styles.sectionDescription}>
                    {t('companyResearch.progress.selectRowToViewProcess')}
                  </p>
                </div>
              </div>
              {retryMutation.isError ? (
                <p className={styles.retryError} role="alert">
                  {getApiErrorMessage(retryMutation.error)}
                </p>
              ) : null}
              {displayedCapabilities.length > 0 ? (
                <ul className={styles.capabilityList}>
                  {displayedCapabilities.map((capability) => {
                    const isExpanded = expandedCapabilities.has(capability.name);
                    const agent = findCompanyResearchAgent(task.agents, capability.name);
                    const thinkingSteps = getCompanyResearchThinkingSteps(agent?.messages, agent);
                    const latestThinkingStep = thinkingSteps.at(-1);
                    const serverDisplayName = capability.displayName?.trim();
                    const capabilityLabel =
                      serverDisplayName && serverDisplayName !== capability.name
                        ? serverDisplayName
                        : t(
                            `companyResearch.capabilities.${getCapabilityLabelKey(capability.name)}`,
                          );
                    const latestProgress =
                      (latestThinkingStep
                        ? getCompanyResearchThinkingStepSummary(latestThinkingStep, language)
                        : undefined) ||
                      agent?.summary ||
                      (agent?.errorMessage ? translateApiMessage(agent.errorMessage) : undefined) ||
                      (agent?.progress !== undefined &&
                      agent.progress >= 100 &&
                      capability.status === 'running'
                        ? t('companyResearch.progress.reportPending')
                        : capability.status === 'failed' && task.failReason
                          ? translateApiMessage(task.failReason)
                          : t(`companyResearch.progress.latest.${capability.status}`));
                    const detailId = `capability-detail-${encodeURIComponent(capability.name)}`;
                    const capabilityRole = getCapabilityRole(capability.name);
                    const isRetryingCapability =
                      retryMutation.isPending &&
                      retryMutation.variables?.taskId === taskId &&
                      retryMutation.variables?.capability === capability.name;
                    return (
                      <li
                        className={styles.capabilityItem}
                        data-status={capability.status}
                        data-expanded={isExpanded}
                        key={capability.name}
                      >
                        <div className={styles.capabilityRowShell}>
                          <button
                            className={styles.capabilityToggle}
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={detailId}
                            onClick={() => toggleCapability(capability.name)}
                          >
                            <span
                              className={styles.capabilityIcon}
                              data-role={capabilityRole}
                              aria-hidden
                            >
                              <CapabilityRoleIcon role={capabilityRole} />
                            </span>
                            <span className={styles.capabilitySummary}>
                              <strong>{capabilityLabel}</strong>
                              <span className={styles.capabilityStateLine}>
                                <span
                                  className={styles.capabilityStatus}
                                  data-status={capability.status}
                                >
                                  <span className={styles.capabilityStatusDot} aria-hidden />
                                  {t(`companyResearch.capabilityStatus.${capability.status}`)}
                                </span>
                              </span>
                            </span>
                            <span className={styles.capabilityLatestWrap}>
                              <span className={styles.capabilityLatestLabel}>
                                {t('companyResearch.progress.latestProgress')}
                              </span>
                              <span className={styles.capabilityLatest} aria-live="polite">
                                {latestProgress}
                              </span>
                            </span>
                            <span className={styles.capabilityChevron} aria-hidden="true">
                              <ReferenceIcon name="chevron-down" />
                            </span>
                          </button>
                          <div className={styles.capabilityActions}>
                            {capability.status === 'succeeded' ? (
                              <Link
                                className={styles.agentDetailLink}
                                to={`/research/${encodeURIComponent(taskId)}/agents/${encodeURIComponent(capability.name)}/report`}
                                state={{
                                  returnTo: `/research/${encodeURIComponent(taskId)}/progress`,
                                }}
                              >
                                {t('companyResearch.progress.agentDetail')}
                                <ChevronRight size={15} aria-hidden />
                              </Link>
                            ) : capability.status === 'failed' && !canRetryReport ? (
                              <span
                                className={styles.retryButtonTooltip}
                                title={retryDisabledReason}
                              >
                                <button
                                  className={styles.retryButton}
                                  type="button"
                                  disabled={isRetryDisabled}
                                  aria-busy={isRetryingCapability}
                                  aria-describedby={
                                    retryDisabledReason ? `${detailId}-retry-disabled` : undefined
                                  }
                                  onClick={() => {
                                    if (isRetryDisabled) return;
                                    retryMutation.mutate({
                                      taskId,
                                      capability: capability.name,
                                      identityScope,
                                    });
                                  }}
                                >
                                  {isRetryingCapability ? (
                                    <Loader2 size={15} className={styles.spin} aria-hidden />
                                  ) : (
                                    <RotateCcw size={15} aria-hidden />
                                  )}
                                  {t(
                                    isRetryingCapability
                                      ? 'companyResearch.progress.retrying'
                                      : 'companyResearch.progress.retryCapability',
                                  )}
                                </button>
                                {retryDisabledReason ? (
                                  <span
                                    id={`${detailId}-retry-disabled`}
                                    className={styles.visuallyHidden}
                                  >
                                    {retryDisabledReason}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <CompanyResearchThinkingTrail
                          id={detailId}
                          agentName={capabilityLabel}
                          agent={agent}
                          steps={thinkingSteps}
                          isExpanded={isExpanded}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.emptyAgents}>{t('companyResearch.progress.noCapabilities')}</p>
              )}
            </section>

            {task.stages?.length ? (
              <section className={styles.stages} aria-labelledby="research-stages-title">
                <h2 id="research-stages-title" className={styles.sectionTitle}>
                  {t('companyResearch.progress.stages')}
                </h2>
                <ol className={styles.stageList}>
                  {task.stages.map((stage) => (
                    <li key={stage.key} data-status={stage.status}>
                      <span>{t(`companyResearch.stages.${stage.key}`)}</span>
                      <small>{t(`companyResearch.stageStatus.${stage.status}`)}</small>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        )}
      </main>
      <ResearchErrorToast
        message={retryReportMutation.isError ? t('apiErrors.generic') : ''}
        toastKey={retryReportMutation.submittedAt}
      />
    </AppShell>
  );
}
