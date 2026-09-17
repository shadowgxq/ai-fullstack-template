import { AlertCircle, LogIn, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuthStore, useLoginModal } from '../../features/auth';
import { useDebouncedValue } from '../../features/research-launch/model/useDebouncedValue';
import {
  DeleteHistoryDialog,
  RESEARCH_HISTORY_PREVIEW_SIZE,
  useDeleteResearchHistoryRecord,
  useResearchHistoryList,
} from '../../features/research-history';
import { History, Search, X } from '../../shared/icons';
import { getDeviceId } from '../../shared/identity';
import { Button } from '../../shared/ui/Button';
import { PageState } from '../../shared/ui/PageState';
import { AppShell } from '../../widgets/app-shell';
import { HistoryRecordCard } from './ui/HistoryRecordCard';
import styles from './HistoryPage.module.css';

const SEARCH_DEBOUNCE_MS = 300;

export function HistoryPage() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  const openLogin = useLoginModal((state) => state.openLogin);
  const [keywordInput, setKeywordInput] = useState('');
  const debouncedKeyword = useDebouncedValue(keywordInput.trim(), SEARCH_DEBOUNCE_MS);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const accessMode = isAuthenticated ? 'full' : 'preview';
  const identityScope = isAuthenticated ? `user:${userId ?? 'current'}` : `device:${getDeviceId()}`;

  const historyQuery = useResearchHistoryList({
    keyword: debouncedKeyword,
    accessMode,
    identityScope,
  });
  const deleteMutation = useDeleteResearchHistoryRecord(debouncedKeyword, identityScope);

  const fetchedRecords = historyQuery.data?.pages.flatMap((page) => page.records) ?? [];
  // UI 层再做一次截断，兼容服务端暂时忽略 size 参数的版本，确保匿名态不会展示完整列表。
  const records = isAuthenticated
    ? fetchedRecords
    : fetchedRecords.slice(0, RESEARCH_HISTORY_PREVIEW_SIZE);
  const totalRecords = historyQuery.data?.pages[0]?.total ?? 0;
  const hasKeyword = debouncedKeyword.length > 0;
  const showPreviewPrompt =
    !isAuthenticated && !historyQuery.isPending && !historyQuery.isError && totalRecords > 0;
  const pendingRecord = records.find((record) => record.taskId === pendingDeleteTaskId) ?? null;
  const pendingRecordLabel = pendingRecord
    ? (pendingRecord.companyName ?? pendingRecord.objectName ?? pendingRecord.query)
    : '';

  const recordHeader = (
    <div className={styles.recordHead}>
      <span>{t('history.table.object')}</span>
      <span>{t('history.table.objectType')}</span>
      <span>{t('history.table.market')}</span>
      <span>{t('history.table.createdAt')}</span>
      <span>{t('history.table.status')}</span>
      <span aria-hidden="true" />
    </div>
  );

  function closeDeleteDialog() {
    setPendingDeleteTaskId(null);
    deleteMutation.reset();
  }

  function confirmDelete() {
    if (!pendingDeleteTaskId) {
      return;
    }
    deleteMutation.mutate(pendingDeleteTaskId, {
      onSuccess: () => setPendingDeleteTaskId(null),
    });
  }

  return (
    <AppShell
      className={styles.page}
      mobileBack={{ to: '/research/new', label: t('history.back') }}
    >
      <main className={styles.main}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t('history.title')}</h1>
        </header>

        {isAuthenticated ? (
          <div className={styles.searchRow}>
            <Search size={18} aria-hidden="true" className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={t('history.searchPlaceholder')}
              aria-label={t('history.searchLabel')}
            />
            {keywordInput ? (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => setKeywordInput('')}
                aria-label={t('history.clearSearch')}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}

        {historyQuery.isPending ? (
          <div
            className={styles.loadingCard}
            aria-busy="true"
            role="status"
            aria-label={t('history.loading')}
          >
            <div className={styles.loadingCardHeader} aria-hidden="true">
              <span className={`${styles.skeletonBlock} ${styles.loadingTitle}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingStatus}`} />
            </div>
            <div className={styles.loadingDetails} aria-hidden="true">
              <span className={`${styles.skeletonBlock} ${styles.loadingDetail}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingDetail}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingDetail}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingDetail}`} />
            </div>
            <div className={styles.loadingFooter} aria-hidden="true">
              <span className={`${styles.skeletonBlock} ${styles.loadingFooterLabel}`} />
              <span className={`${styles.skeletonBlock} ${styles.loadingFooterAction}`} />
            </div>
          </div>
        ) : historyQuery.isError ? (
          <PageState
            icon={<AlertCircle size={22} />}
            title={t('history.loadError.title')}
            description={t('history.loadError.description')}
            action={
              <Button variant="secondary" onClick={() => void historyQuery.refetch()}>
                {t('history.loadError.retry')}
              </Button>
            }
          />
        ) : records.length === 0 && hasKeyword ? (
          <PageState
            icon={<SearchX size={22} />}
            title={t('history.noResults.title')}
            description={t('history.noResults.description')}
            action={
              <div className={styles.stateActions}>
                <Button variant="secondary" onClick={() => setKeywordInput('')}>
                  {t('history.noResults.clearSearch')}
                </Button>
                <Link className={styles.primaryAction} to="/">
                  {t('history.noResults.backHome')}
                </Link>
              </div>
            }
          />
        ) : records.length === 0 ? (
          <PageState
            icon={<History size={22} />}
            title={t('history.empty.title')}
            description={t('history.empty.desc')}
            action={
              <Link className={styles.primaryAction} to="/research/new">
                {t('history.empty.action')}
              </Link>
            }
          />
        ) : (
          <>
            <div className={styles.records} aria-label={t('history.recordsLabel')}>
              {recordHeader}
              <ul className={styles.list}>
                {records.map((record) => (
                  <li key={record.taskId}>
                    <HistoryRecordCard
                      record={record}
                      onDeleteClick={
                        isAuthenticated ? () => setPendingDeleteTaskId(record.taskId) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
            {historyQuery.hasNextPage ? (
              <div className={styles.loadMoreRow}>
                <Button
                  variant="secondary"
                  isPending={historyQuery.isFetchingNextPage}
                  onClick={() => void historyQuery.fetchNextPage()}
                >
                  {t('history.loadMore')}
                </Button>
              </div>
            ) : null}
          </>
        )}

        {showPreviewPrompt ? (
          <section className={styles.previewPrompt} aria-labelledby="history-preview-title">
            <span className={styles.previewIcon} aria-hidden="true">
              <LogIn size={20} />
            </span>
            <div className={styles.previewCopy}>
              <span className={styles.previewEyebrow}>
                {t('history.preview.eyebrow', { limit: RESEARCH_HISTORY_PREVIEW_SIZE })}
              </span>
              <h2 id="history-preview-title" className={styles.previewTitle}>
                {t('history.preview.title')}
              </h2>
              <p className={styles.previewDescription}>
                {t('history.preview.description', { count: records.length })}
              </p>
            </div>
            {/* 不登记续做动作：本页的 accessMode / identityScope 由登录态推导并进入
                query key，登录后 key 变化，列表自己就会重新拉取。 */}
            <button type="button" className={styles.primaryAction} onClick={() => openLogin()}>
              {t('history.preview.action')}
            </button>
          </section>
        ) : null}

        {isAuthenticated ? <p className={styles.disclaimer}>{t('history.disclaimer')}</p> : null}
      </main>

      <DeleteHistoryDialog
        open={pendingDeleteTaskId !== null}
        recordLabel={pendingRecordLabel}
        isPending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? t('history.deleteDialog.error') : undefined}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
