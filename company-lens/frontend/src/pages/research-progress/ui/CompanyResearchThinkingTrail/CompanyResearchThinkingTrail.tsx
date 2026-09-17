import { ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { CompanyResearchAgentBlock } from '../../../../entities/company-research';
import { toApiLanguage } from '../../../../shared/api';
import {
  getCompanyResearchThinkingStepSummary,
  getCompanyResearchThinkingStepTitle,
  normalizeResearchAgentName,
  type CompanyResearchThinkingStep,
} from '../../model/research-progress-thinking';
import styles from './CompanyResearchThinkingTrail.module.css';

const VISIBLE_STEP_LIMIT = 5;
const BOTTOM_FOLLOW_THRESHOLD_PX = 24;

type CompanyResearchThinkingTrailProps = Readonly<{
  id: string;
  agentName: string;
  agent?: CompanyResearchAgentBlock;
  steps: readonly CompanyResearchThinkingStep[];
  isExpanded: boolean;
}>;

function formatAgentName(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function isMachineTitle(value: string): boolean {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(value);
}

function getThinkingTitle(
  step: CompanyResearchThinkingStep,
  language: 'zh-CN' | 'en-US',
  translate: (key: string, options?: { defaultValue?: string }) => string,
): string {
  const title = getCompanyResearchThinkingStepTitle(step, language)?.trim();
  if (title && !isMachineTitle(title)) return title;
  const eventType = step.eventType?.trim().toLowerCase();
  if (eventType) {
    return translate(`companyResearch.progress.thinkingEventTypes.${eventType}`, {
      defaultValue: formatAgentName(eventType),
    });
  }
  return title || translate('companyResearch.progress.thinkingEvent');
}

function formatTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(timestamp);
}

function ThinkingTimeline({
  agentName,
  steps,
}: Readonly<{ agentName: string; steps: readonly CompanyResearchThinkingStep[] }>) {
  const { t, i18n } = useTranslation();
  const language = toApiLanguage(i18n.resolvedLanguage ?? i18n.language);
  const normalizedParentName = normalizeResearchAgentName(agentName);

  return (
    <ol className={styles.timeline}>
      {steps.map((step, index) => {
        const stepAgentName = step.agentName?.trim();
        const showStepAgent =
          Boolean(stepAgentName) &&
          normalizeResearchAgentName(stepAgentName ?? '') !== normalizedParentName;
        const time = formatTime(step.createTime);
        return (
          <li
            className={styles.timelineItem}
            data-thinking-step
            key={step.stepId}
            aria-current={index === steps.length - 1 ? 'step' : undefined}
          >
            <span className={styles.timelineDot} aria-hidden="true" />
            {time ? (
              <time className={styles.timelineTime} dateTime={step.createTime}>
                {time}
              </time>
            ) : (
              <span className={styles.timelineTime} aria-hidden="true" />
            )}
            <div className={styles.timelineCopy}>
              <div className={styles.timelineMeta}>
                <strong>{getThinkingTitle(step, language, t)}</strong>
                {showStepAgent ? <span>{formatAgentName(stepAgentName ?? '')}</span> : null}
                {step.progress !== undefined ? <span>{step.progress}%</span> : null}
              </div>
              <p>{getCompanyResearchThinkingStepSummary(step, language)}</p>
              {step.sourceLinks?.length ? (
                <ul className={styles.sourceLinks}>
                  {step.sourceLinks.map((source) => (
                    <li key={source.url}>
                      <a
                        className={styles.sourceLink}
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={source.url}
                      >
                        <span>{source.label}</span>
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {step.sourceRefs?.length ? (
                <span className={styles.sourceCount}>
                  {t('companyResearch.progress.messageSources', { count: step.sourceRefs.length })}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CompanyResearchThinkingTrail({
  id,
  agentName,
  agent,
  steps,
  isExpanded,
}: CompanyResearchThinkingTrailProps) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousStepCountRef = useRef(steps.length);
  const previousExpandedRef = useRef(false);
  const shouldFollowLatestRef = useRef(true);
  const isScrollable = steps.length > VISIBLE_STEP_LIMIT;

  useEffect(() => {
    const previousStepCount = previousStepCountRef.current;
    const wasExpanded = previousExpandedRef.current;
    const hasNewStep = steps.length > previousStepCount;
    const shouldScrollToLatest =
      isExpanded && (!wasExpanded || (hasNewStep && shouldFollowLatestRef.current));
    previousStepCountRef.current = steps.length;
    previousExpandedRef.current = isExpanded;
    if (!shouldScrollToLatest) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      viewport?.scrollTo?.({
        top: viewport.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isExpanded, steps.length]);

  return (
    <div id={id} className={styles.details} data-expanded={isExpanded} aria-hidden={!isExpanded}>
      <div className={styles.detailsInner}>
        {steps.length > 0 ? (
          <>
            <div
              ref={viewportRef}
              className={styles.timelineViewport}
              data-scrollable={isScrollable}
              role="region"
              aria-label={t('research.progress.thinkingTimelineLabel', { agentName })}
              tabIndex={isExpanded && isScrollable ? 0 : -1}
              onScroll={(event) => {
                const viewport = event.currentTarget;
                shouldFollowLatestRef.current =
                  viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
                  BOTTOM_FOLLOW_THRESHOLD_PX;
              }}
            >
              <ThinkingTimeline agentName={agent?.agentName ?? agentName} steps={steps} />
            </div>
          </>
        ) : (
          <p className={styles.empty}>{t('companyResearch.progress.thinkingNoSteps')}</p>
        )}
      </div>
    </div>
  );
}
