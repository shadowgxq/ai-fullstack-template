import {
  Bot,
  ChevronDown,
  ChevronRight,
  CircleMinus,
  ClipboardCheck,
  Crosshair,
  GitMerge,
  ListFilter,
  Loader2,
  Radar,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { MouseEvent } from 'react';

import {
  isDecisionAggregatorAgentType,
  normalizeResearchAgentType,
  type ResearchAgentProgress,
  type ResearchThinkingStep,
} from '../../../../entities/research';
import { AgentThinkingDetails, AgentThinkingPreview } from './AgentThinkingTrail';
import styles from './AgentProgressRow.module.css';

const AGENT_NAME_KEYS: Readonly<Record<string, string>> = {
  industry_research: 'research.progress.agentNames.industryResearch',
  bottleneck_hunter: 'research.progress.agentNames.bottleneckHunter',
  quality_screen: 'research.progress.agentNames.qualityScreen',
  industry_funnel: 'research.progress.agentNames.industryFunnel',
  investment_checklist: 'research.progress.agentNames.investmentChecklist',
  decision_aggregator: 'research.progress.agentNames.decisionAggregator',
};

function formatAgentTypeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

export type AgentProgressRowProps = {
  projectId: string;
  agent: ResearchAgentProgress;
  thinkingSteps: readonly ResearchThinkingStep[];
  isExpanded: boolean;
  resultReady: boolean;
  retryPending: boolean;
  onToggle: (agentId: string) => void;
  onRetry: (agentType: string) => void;
  onNavigate: (agentId: string) => void;
};

function AgentRoleIcon({ agentType }: Pick<ResearchAgentProgress, 'agentType'>) {
  switch (normalizeResearchAgentType(agentType)) {
    case 'industry_research':
      return <Radar size={18} aria-hidden />;
    case 'bottleneck_hunter':
      return <Crosshair size={18} aria-hidden />;
    case 'quality_screen':
      return <ShieldCheck size={18} aria-hidden />;
    case 'industry_funnel':
      return <ListFilter size={18} aria-hidden />;
    case 'investment_checklist':
      return <ClipboardCheck size={18} aria-hidden />;
    case 'decision_aggregator':
      return <GitMerge size={18} aria-hidden />;
    default:
      return <Bot size={18} aria-hidden />;
  }
}

export function AgentProgressRow({
  projectId,
  agent,
  thinkingSteps,
  isExpanded,
  resultReady,
  retryPending,
  onToggle,
  onRetry,
  onNavigate,
}: AgentProgressRowProps) {
  const { t } = useTranslation();
  const normalizedAgentType = normalizeResearchAgentType(agent.agentType);
  const serverDisplayName = agent.displayName?.trim();
  const localizedNameKey = AGENT_NAME_KEYS[normalizedAgentType];
  const hasMachineDisplayName =
    Boolean(serverDisplayName) &&
    normalizeResearchAgentType(serverDisplayName ?? '') === normalizedAgentType;
  const displayName = localizedNameKey
    ? t(localizedNameKey)
    : serverDisplayName && !hasMachineDisplayName
      ? serverDisplayName
      : formatAgentTypeLabel(normalizedAgentType);
  const isFailed = agent.status === 'failed';
  const isCancelled = agent.status === 'cancelled';
  const hasResultLink = !isFailed && isDecisionAggregatorAgentType(agent.agentType) && resultReady;
  const hasReportLink =
    !isFailed && !hasResultLink && agent.agentId.trim().length > 0 && agent.reportReady;
  const hasDestination = hasResultLink || hasReportLink;
  const destination = hasResultLink
    ? `/research/${encodeURIComponent(projectId)}/result`
    : `/research/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agent.agentId)}/report`;
  const statusLabel = t(`research.progress.agentStatus.${agent.status}`);
  const summary = agent.summary?.trim();
  const supportingText =
    !isFailed && summary && summary !== 'Mock Agent completed.' ? summary : undefined;
  const showProgress = agent.status === 'running' && agent.progressPercent !== undefined;
  const hasThinkingSteps = thinkingSteps.length > 0;
  const latestThinkingStep = thinkingSteps.at(-1);
  const rowId = `agent-row-${encodeURIComponent(agent.agentId || agent.agentType)}`;
  const detailsId = `${rowId}-thinking`;

  const statusContent = (
    <span className={styles.status}>
      {agent.status === 'running' ? (
        <Loader2 className={styles.spinner} size={14} aria-hidden="true" />
      ) : (
        <span className={styles.statusDot} aria-hidden="true" />
      )}
      <span>{statusLabel}</span>
      {showProgress ? <span className={styles.percent}>{agent.progressPercent}%</span> : null}
    </span>
  );

  const content = (
    <>
      <span className={styles.icon} data-agent-type={normalizedAgentType} aria-hidden="true">
        <AgentRoleIcon agentType={agent.agentType} />
      </span>

      <span className={styles.content}>
        <span className={styles.copy}>
          <strong className={styles.name}>{displayName}</strong>
          <span className={styles.statusGroup}>{statusContent}</span>
        </span>

        <span className={styles.thinkingCell}>
          {hasThinkingSteps && !agent.errorMessage ? (
            <AgentThinkingPreview step={latestThinkingStep} fallback={supportingText} />
          ) : supportingText ? (
            <span className={styles.supportingText} data-error={Boolean(agent.errorMessage)}>
              {supportingText}
            </span>
          ) : isCancelled ? (
            <span className={styles.cancelledNote}>
              <CircleMinus size={14} aria-hidden="true" />
              <span>{t('research.progress.thinkingCancelled')}</span>
            </span>
          ) : !isFailed ? (
            <span className={styles.supportingText}>{t('research.progress.thinkingWaiting')}</span>
          ) : null}
          {showProgress ? (
            <progress
              className={styles.progressBar}
              max={100}
              value={agent.progressPercent}
              aria-label={`${displayName} ${statusLabel}`}
            />
          ) : null}
        </span>
      </span>

      {hasThinkingSteps ? (
        <ChevronDown
          className={styles.expandIcon}
          data-expanded={isExpanded}
          size={18}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const handleDestinationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
      onNavigate(rowId);
    }
  };

  return (
    <li className={styles.item} data-status={agent.status}>
      <div className={styles.rowShell}>
        {hasThinkingSteps ? (
          <button
            id={rowId}
            type="button"
            className={styles.row}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${displayName}, ${statusLabel}, ${t(
              isExpanded
                ? 'research.progress.thinkingCollapse'
                : 'research.progress.thinkingExpand',
            )}`}
            onClick={() => onToggle(agent.agentId)}
          >
            {content}
          </button>
        ) : (
          <div className={styles.row}>{content}</div>
        )}

        {hasDestination || agent.canRetry ? (
          <div className={styles.rowActions}>
            {hasDestination ? (
              <Link
                id={hasThinkingSteps ? undefined : rowId}
                className={styles.rowAction}
                aria-label={`${displayName}, ${statusLabel}, ${t(
                  hasResultLink ? 'research.progress.viewResult' : 'research.progress.report',
                )}`}
                to={destination}
                state={
                  hasResultLink
                    ? undefined
                    : { returnTo: `/research/${encodeURIComponent(projectId)}/progress` }
                }
                onClick={handleDestinationClick}
              >
                {t(hasResultLink ? 'research.progress.viewResult' : 'research.progress.report')}
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ) : null}
            {agent.canRetry ? (
              <button
                type="button"
                className={styles.retry}
                onClick={() => onRetry(agent.agentType)}
                disabled={retryPending}
              >
                <RotateCcw size={13} aria-hidden="true" />
                {retryPending ? t('research.progress.retrying') : t('research.progress.retryAgent')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasThinkingSteps ? (
        <AgentThinkingDetails
          id={detailsId}
          triggerId={rowId}
          agentName={displayName}
          steps={thinkingSteps}
          isExpanded={isExpanded}
          onExpandedChange={(nextIsExpanded) => {
            if (nextIsExpanded !== isExpanded) {
              onToggle(agent.agentId);
            }
          }}
        />
      ) : null}
    </li>
  );
}
