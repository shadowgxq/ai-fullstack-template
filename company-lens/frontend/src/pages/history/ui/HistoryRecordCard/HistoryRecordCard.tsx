import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { MARKET_LABEL_KEY } from '../../../../entities/market';
import type { ResearchHistoryRecord } from '../../../../features/research-history';
import { ChevronRight, Trash2 } from '../../../../shared/icons';
import {
  getHistoryRecordDestination,
  getHistoryRecordPath,
} from '../../model/history-record-route';
import styles from './HistoryRecordCard.module.css';

export type HistoryRecordCardProps = {
  record: ResearchHistoryRecord;
  onDeleteClick?: () => void;
};

/** 缺失的可选字段统一展示为长破折号，不占用 i18n key（标点符号，无需翻译）。 */
const PLACEHOLDER = '—';

function formatCreatedAt(value: string, locale: string): string {
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

export function HistoryRecordCard({
  record,
  onDeleteClick,
}: HistoryRecordCardProps) {
  const { t, i18n } = useTranslation();

  const marketLabel = !record.market
    ? undefined
    : record.market === 'unknown'
      ? record.rawMarket
      : t(MARKET_LABEL_KEY[record.market]);

  const headerParts = [record.companyName, record.stockCode, marketLabel].filter(
    (part): part is string => Boolean(part),
  );
  const displayName = record.companyName ?? record.objectName ?? record.query;
  const headerTitle = headerParts.length > 0 ? headerParts.join(' · ') : displayName;
  const secondaryLabel = record.stockCode ?? record.query;
  const statusLabel = t(`history.status.${record.status}`);
  const destination = getHistoryRecordDestination(record);
  const actionLabel = t(
    destination === 'result' ? 'history.table.viewReport' : 'history.table.viewProgress',
  );
  const actionAriaLabel = t(
    destination === 'result'
      ? 'history.card.viewReportAriaLabel'
      : 'history.card.viewProgressAriaLabel',
    { name: displayName },
  );
  return (
    <article className={styles.card}>
      <Link
        to={getHistoryRecordPath(record)}
        className={styles.cardLink}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className={styles.objectCell}>
        <h2 className={styles.headerTitle}>{displayName}</h2>
        <span className={styles.objectCode}>{secondaryLabel}</span>
      </div>

      <span className={styles.metaCell}>{t(`history.objectType.${record.objectType}`)}</span>
      <span className={styles.metaCell}>{marketLabel ?? PLACEHOLDER}</span>
      <span className={styles.createdAt}>{formatCreatedAt(record.createdAt, i18n.language)}</span>
      <span className={styles.statusPill} data-status={record.status}>
        <span className={styles.statusDot} aria-hidden="true" />
        {statusLabel}
      </span>

      <div className={styles.actions}>
        <Link
          to={getHistoryRecordPath(record)}
          className={styles.viewAction}
          aria-label={actionAriaLabel}
        >
          <span>{actionLabel}</span>
          <span className={styles.viewArrow}>
            <ChevronRight size={15} aria-hidden="true" />
          </span>
        </Link>
        {onDeleteClick ? (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDeleteClick}
            aria-label={t('history.deleteAction', { name: displayName })}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      <dl className={styles.screenReaderDetails}>
        {headerTitle !== displayName ? (
          <div>
            <dt>{t('history.card.summary')}</dt>
            <dd>{headerTitle}</dd>
          </div>
        ) : null}
        {record.query !== displayName ? (
          <div>
            <dt>{t('history.card.originalQuery')}</dt>
            <dd>{record.query}</dd>
          </div>
        ) : null}
        {record.conclusion ? (
          <div>
            <dt>{t('history.card.conclusion')}</dt>
            <dd>
              <span>{t(`history.decision.${record.conclusion.decision}`)}</span>{' '}
              <span>{t(`history.confidence.${record.conclusion.confidence}`)}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
