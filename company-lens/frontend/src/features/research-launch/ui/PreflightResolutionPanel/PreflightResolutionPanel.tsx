import { useTranslation } from 'react-i18next';

import { MARKET_LABEL_KEY, type MarketCode } from '../../../../entities/market';
import type {
  ResearchPreflightResolution,
  ResearchPreflightResolutionType,
} from '../../../../entities/research';
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle } from '../../../../shared/icons';
import styles from './PreflightResolutionPanel.module.css';

export type PreflightResolutionPanelProps = {
  query: string;
  currentMarket: MarketCode;
  message?: string;
  resolutions: readonly ResearchPreflightResolution[];
  pendingResolution?: ResearchPreflightResolutionType;
  isPending: boolean;
  hasError: boolean;
  onConfirm: (resolution: ResearchPreflightResolution) => void;
  onBack: () => void;
};

function orderResolutions(
  resolutions: readonly ResearchPreflightResolution[],
): readonly ResearchPreflightResolution[] {
  const primary = resolutions.find((resolution) => resolution.type === 'switch_market');
  if (!primary) {
    return resolutions;
  }
  return [primary, ...resolutions.filter((resolution) => resolution !== primary)];
}

export function PreflightResolutionPanel({
  query,
  currentMarket,
  message,
  resolutions,
  pendingResolution,
  isPending,
  hasError,
  onConfirm,
  onBack,
}: PreflightResolutionPanelProps) {
  const { t } = useTranslation();
  const orderedResolutions = orderResolutions(resolutions);
  const primaryResolution = orderedResolutions[0];

  return (
    <section
      className={styles.root}
      aria-labelledby="research-preflight-title"
      aria-describedby="research-preflight-description"
      aria-busy={isPending}
    >
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <AlertCircle size={20} />
        </span>
        <div>
          <span className={styles.eyebrow}>{t('research.conflict.eyebrow')}</span>
          <h2 id="research-preflight-title" className={styles.title}>
            {t('research.conflict.title')}
          </h2>
        </div>
      </div>

      <p id="research-preflight-description" className={styles.description}>
        {message || t('research.conflict.description')}
      </p>

      <div className={styles.context} role="group" aria-label={t('research.conflict.contextLabel')}>
        <div className={styles.contextItem}>
          <span className={styles.contextLabel}>{t('research.conflict.queryLabel')}</span>
          <strong className={styles.contextValue}>{query}</strong>
        </div>
        <div className={styles.contextArrow} aria-hidden="true">
          <ChevronRight size={16} />
        </div>
        <div className={styles.contextItem}>
          <span className={styles.contextLabel}>{t('research.conflict.currentMarket')}</span>
          <strong className={styles.contextValue}>{t(MARKET_LABEL_KEY[currentMarket])}</strong>
        </div>
        {primaryResolution && primaryResolution.market !== currentMarket ? (
          <>
            <div className={styles.contextArrow} aria-hidden="true">
              <ChevronRight size={16} />
            </div>
            <div className={styles.contextItem}>
              <span className={styles.contextLabel}>{t('research.conflict.targetMarket')}</span>
              <strong className={styles.contextValue}>
                {t(MARKET_LABEL_KEY[primaryResolution.market])}
              </strong>
            </div>
          </>
        ) : null}
      </div>

      <div className={styles.options}>
        {orderedResolutions.map((resolution, index) => {
          const isCurrent = isPending && pendingResolution === resolution.type;
          return (
            <button
              key={`${resolution.type}:${resolution.market}`}
              type="button"
              className={styles.option}
              data-primary={index === 0}
              disabled={isPending}
              onClick={() => onConfirm(resolution)}
            >
              <span className={styles.optionContent}>
                <span className={styles.optionLabel}>{resolution.label}</span>
                <span className={styles.optionMeta}>
                  {t(MARKET_LABEL_KEY[resolution.market])}
                  <span aria-hidden="true"> · </span>
                  {resolution.resolvedQuery}
                </span>
              </span>
              {isCurrent ? (
                <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
              ) : (
                <ChevronRight size={18} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {hasError ? (
        <p className={styles.error} role="alert">
          {t('research.conflict.confirmError')}
        </p>
      ) : null}

      <button type="button" className={styles.back} disabled={isPending} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden="true" />
        {t('research.conflict.cancel')}
      </button>
    </section>
  );
}
