import { useTranslation } from 'react-i18next';

import { MARKET_LABEL_KEY } from '../../../../entities/market';
import type { StockCandidate } from '../../../../entities/research';
import { Check, X } from '../../../../shared/icons';
import styles from './StockCandidateList.module.css';

export type StockCandidateListProps = {
  candidates?: readonly StockCandidate[];
  isError: boolean;
  isDisabled: boolean;
  selectedStock?: StockCandidate;
  onSelect: (candidate: StockCandidate) => void;
  onClear: () => void;
};

export function StockCandidateList({
  candidates,
  isError,
  isDisabled,
  selectedStock,
  onSelect,
  onClear,
}: StockCandidateListProps) {
  const { t } = useTranslation();

  if (selectedStock) {
    return (
      <div className={styles.selected} aria-live="polite">
        <Check size={16} aria-hidden />
        <span className={styles.selectedMain}>
          <strong>{selectedStock.symbol}</strong>
          <span>
            {selectedStock.companyName} · {t(MARKET_LABEL_KEY[selectedStock.market])}
          </span>
        </span>
        <button
          type="button"
          className={styles.clear}
          disabled={isDisabled}
          onClick={onClear}
          aria-label={t('research.candidates.clearSelection')}
          title={t('research.candidates.clearSelection')}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    );
  }

  if (isError) {
    return (
      <p id="research-stock-candidate-status" className={styles.status} role="status">
        {t('research.candidates.error')}
      </p>
    );
  }

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div className={styles.root}>
      <p className={styles.hint}>{t('research.candidates.hint')}</p>
      <ul
        id="research-stock-candidates"
        className={styles.list}
        role="listbox"
        aria-label={t('research.candidates.listLabel')}
      >
        {candidates.map((candidate, index) => (
          <li key={candidate.stockId}>
            <button
              id={`research-stock-candidate-${index}`}
              type="button"
              className={styles.option}
              role="option"
              aria-selected="false"
              disabled={isDisabled}
              onClick={() => onSelect(candidate)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  document
                    .getElementById(
                      `research-stock-candidate-${Math.min(index + 1, candidates.length - 1)}`,
                    )
                    ?.focus();
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (index === 0) {
                    document.getElementById('research-query')?.focus();
                  } else {
                    document.getElementById(`research-stock-candidate-${index - 1}`)?.focus();
                  }
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  document.getElementById('research-query')?.focus();
                }
              }}
            >
              <span className={styles.optionMain}>
                <strong>{candidate.symbol}</strong>
                <span>{candidate.companyName}</span>
              </span>
              <span className={styles.optionMeta}>
                {t(MARKET_LABEL_KEY[candidate.market])} · {candidate.exchange}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
