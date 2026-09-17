import * as Dialog from '@radix-ui/react-dialog';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ExternalLink, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';

import type { ResearchThinkingStep } from '../../../../entities/research';
import styles from './AgentThinkingTrail.module.css';

gsap.registerPlugin(useGSAP);

const VISIBLE_STEP_LIMIT = 5;
const BOTTOM_FOLLOW_THRESHOLD_PX = 24;
const MOBILE_MEDIA_QUERY = '(max-width: 720px)';

function subscribeToMobileViewport(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getMobileViewportSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, () => false);
}

function getFirstWebSourceUrl(sourceRefs: readonly string[] | undefined): string | undefined {
  const firstSourceRef = sourceRefs?.[0];
  if (!firstSourceRef) {
    return undefined;
  }

  try {
    const url = new URL(firstSourceRef);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function updateTimelineViewportHeight(
  viewport: HTMLDivElement,
  timeline: HTMLOListElement,
  stepCount: number,
) {
  const isScrollable = stepCount > VISIBLE_STEP_LIMIT;
  viewport.dataset.scrollable = String(isScrollable);
  if (!isScrollable) {
    viewport.style.removeProperty('--timeline-max-height');
    return;
  }

  const visibleItems = Array.from(timeline.children)
    .slice(-VISIBLE_STEP_LIMIT)
    .filter((item): item is HTMLElement => item instanceof HTMLElement);
  const firstItem = visibleItems[0];
  const lastItem = visibleItems.at(-1);
  if (!firstItem || !lastItem) {
    return;
  }
  const measuredHeight = lastItem.offsetTop + lastItem.offsetHeight - firstItem.offsetTop;
  if (measuredHeight > 0) {
    viewport.style.setProperty('--timeline-max-height', `${measuredHeight}px`);
  }
}

type AgentThinkingPreviewProps = {
  step?: ResearchThinkingStep;
  fallback?: string;
};

export function AgentThinkingPreview({ step, fallback }: AgentThinkingPreviewProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const nextCopy = step?.summary ?? fallback ?? '';
  const [initialCopy] = useState(nextCopy);

  useGSAP(
    () => {
      const copy = copyRef.current;
      if (!copy || copy.textContent === nextCopy) {
        return;
      }
      if (!copy.textContent || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        copy.textContent = nextCopy;
        gsap.set(copy, { clearProps: 'transform,opacity,visibility' });
        return;
      }

      gsap
        .timeline({ defaults: { overwrite: 'auto' } })
        .addLabel('replace')
        .to(copy, { y: -8, autoAlpha: 0, duration: 0.16, ease: 'power1.in' }, 'replace')
        .call(() => {
          copy.textContent = nextCopy;
        })
        .set(copy, { y: 8 })
        .to(copy, { y: 0, autoAlpha: 1, duration: 0.28, ease: 'power2.out' });
    },
    { dependencies: [nextCopy], scope: rootRef },
  );

  return (
    <span ref={rootRef} className={styles.preview} aria-live="polite" aria-atomic="true">
      <span ref={copyRef} className={styles.previewCopy}>
        {initialCopy}
      </span>
    </span>
  );
}

export type AgentThinkingDetailsProps = {
  id: string;
  triggerId: string;
  agentName: string;
  steps: readonly ResearchThinkingStep[];
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
};

type ThinkingTimelineProps = {
  steps: readonly ResearchThinkingStep[];
};

const ThinkingTimeline = forwardRef<HTMLOListElement, ThinkingTimelineProps>(
  function ThinkingTimeline({ steps }, ref) {
    const { t } = useTranslation();

    return (
      <ol ref={ref} className={styles.timeline}>
        {steps.map((step, index) => {
          const sourceUrl = getFirstWebSourceUrl(step.sourceRefs);

          return (
            <li
              key={step.stepId}
              className={styles.timelineItem}
              data-thinking-step
              aria-current={index === steps.length - 1 ? 'step' : undefined}
            >
              <span className={styles.timelineDot} aria-hidden="true" />
              <div className={styles.timelineMeta}>
                <strong>{step.title || t('research.progress.thinkingDefaultTitle')}</strong>
                <span>
                  {step.progressPercent !== undefined
                    ? t('research.progress.thinkingProgress', {
                        progress: step.progressPercent,
                      })
                    : null}
                  {step.sourceRefs?.length
                    ? t('research.progress.thinkingSources', {
                        count: step.sourceRefs.length,
                      })
                    : null}
                </span>
              </div>
              <p>
                {sourceUrl ? (
                  <a
                    className={styles.sourceLink}
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={sourceUrl}
                  >
                    <span>{step.summary}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  step.summary
                )}
              </p>
            </li>
          );
        })}
      </ol>
    );
  },
);

type AgentThinkingInlineDetailsProps = Omit<
  AgentThinkingDetailsProps,
  'triggerId' | 'onExpandedChange'
>;

function AgentThinkingInlineDetails({
  id,
  agentName,
  steps,
  isExpanded,
}: AgentThinkingInlineDetailsProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLOListElement>(null);
  const previousStepCountRef = useRef(steps.length);
  const previousExpandedRef = useRef(false);
  const shouldFollowLatestRef = useRef(true);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const timeline = timelineRef.current;
    if (viewport && timeline) {
      updateTimelineViewportHeight(viewport, timeline, steps.length);
    }
  }, [steps.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const timeline = timelineRef.current;
    if (!viewport || !timeline || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      updateTimelineViewportHeight(viewport, timeline, steps.length);
    });
    observer.observe(timeline);
    return () => observer.disconnect();
  }, [steps.length]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.to(root, {
        gridTemplateRows: isExpanded ? '1fr' : '0fr',
        autoAlpha: isExpanded ? 1 : 0,
        duration: reduceMotion ? 0 : isExpanded ? 0.3 : 0.2,
        ease: isExpanded ? 'power2.out' : 'power1.inOut',
        overwrite: 'auto',
      });
    },
    { dependencies: [isExpanded], scope: rootRef },
  );

  useGSAP(
    () => {
      const previousStepCount = previousStepCountRef.current;
      const wasExpanded = previousExpandedRef.current;
      const hasNewStep = steps.length > previousStepCount;
      const shouldScrollToLatest =
        isExpanded && (!wasExpanded || (hasNewStep && shouldFollowLatestRef.current));
      previousStepCountRef.current = steps.length;
      previousExpandedRef.current = isExpanded;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isExpanded && hasNewStep && !reduceMotion) {
        const newestItem = rootRef.current?.querySelector('[data-thinking-step]:last-child');
        if (newestItem) {
          gsap.fromTo(
            newestItem,
            { y: 8, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' },
          );
        }
      }

      if (!shouldScrollToLatest) {
        return undefined;
      }
      const frameId = window.requestAnimationFrame(() => {
        const viewport = viewportRef.current;
        if (!viewport) {
          return;
        }
        viewport.scrollTo?.({
          top: viewport.scrollHeight,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        });
      });
      return () => window.cancelAnimationFrame(frameId);
    },
    { dependencies: [isExpanded, steps.length], scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      id={id}
      className={styles.details}
      aria-hidden={!isExpanded}
      data-expanded={isExpanded}
    >
      <div className={styles.detailsInner}>
        <div className={styles.timelineLayout}>
          <div
            ref={viewportRef}
            className={styles.timelineViewport}
            data-scrollable={steps.length > VISIBLE_STEP_LIMIT}
            role="region"
            aria-label={t('research.progress.thinkingTimelineLabel', { agentName })}
            tabIndex={isExpanded && steps.length > VISIBLE_STEP_LIMIT ? 0 : -1}
            onScroll={(event) => {
              const viewport = event.currentTarget;
              shouldFollowLatestRef.current =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
                BOTTOM_FOLLOW_THRESHOLD_PX;
            }}
          >
            <ThinkingTimeline ref={timelineRef} steps={steps} />
          </div>
          <aside className={styles.timelineAside}>
            <div>
              <strong>{t('research.progress.thinkingRecorded')}</strong>
              <span>{t('research.progress.thinkingOrder')}</span>
            </div>
            <span className={styles.stepCount}>{String(steps.length).padStart(2, '0')}</span>
          </aside>
        </div>
      </div>
    </div>
  );
}

type AgentThinkingSheetProps = AgentThinkingDetailsProps;

function AgentThinkingSheet({
  id,
  triggerId,
  agentName,
  steps,
  isExpanded,
  onExpandedChange,
}: AgentThinkingSheetProps) {
  const { t } = useTranslation();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const previousStepCountRef = useRef(steps.length);
  const previousExpandedRef = useRef(false);
  const shouldFollowLatestRef = useRef(true);

  useEffect(() => {
    const previousStepCount = previousStepCountRef.current;
    const wasExpanded = previousExpandedRef.current;
    const hasNewStep = steps.length > previousStepCount;
    const shouldScrollToLatest =
      isExpanded && (!wasExpanded || (hasNewStep && shouldFollowLatestRef.current));
    previousStepCountRef.current = steps.length;
    previousExpandedRef.current = isExpanded;
    if (!shouldScrollToLatest) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current;
      scrollArea?.scrollTo?.({
        top: scrollArea.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isExpanded, steps.length]);

  return (
    <Dialog.Root open={isExpanded} onOpenChange={onExpandedChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.sheetOverlay} />
        <Dialog.Content
          id={id}
          className={styles.sheetContent}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(triggerId)?.focus();
          }}
        >
          <div className={styles.sheetHandle} aria-hidden="true" />
          <div className={styles.sheetHeader}>
            <div className={styles.sheetHeading}>
              <Dialog.Title className={styles.sheetTitle}>
                {t('research.progress.thinkingDialogTitle', { agentName })}
              </Dialog.Title>
              <Dialog.Description className={styles.sheetDescription}>
                {t('research.progress.thinkingDialogDescription', { count: steps.length })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className={styles.sheetClose}
                aria-label={t('research.progress.thinkingDialogClose')}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div
            ref={scrollAreaRef}
            className={styles.sheetScrollArea}
            role="region"
            aria-label={t('research.progress.thinkingTimelineLabel', { agentName })}
            tabIndex={0}
            onScroll={(event) => {
              const scrollArea = event.currentTarget;
              shouldFollowLatestRef.current =
                scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight <=
                BOTTOM_FOLLOW_THRESHOLD_PX;
            }}
          >
            <ThinkingTimeline steps={steps} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AgentThinkingDetails(props: AgentThinkingDetailsProps) {
  const isMobile = useIsMobileViewport();

  return isMobile ? (
    <AgentThinkingSheet {...props} />
  ) : (
    <AgentThinkingInlineDetails
      id={props.id}
      agentName={props.agentName}
      steps={props.steps}
      isExpanded={props.isExpanded}
    />
  );
}
