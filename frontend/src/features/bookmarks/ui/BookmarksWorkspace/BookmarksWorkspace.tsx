import { useQueryClient } from '@tanstack/react-query';
import { Folder } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isApiError } from '../../../../shared/api';
import { Button } from '../../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../shared/ui/select';
import { Skeleton } from '../../../../shared/ui/skeleton';
import { cn } from '../../../../shared/utils/cn';
import { bookmarksApi } from '../../model/bookmarks.api';
import { useBookmarkOperations } from '../../model/bookmarks.operations';
import {
  bookmarkKeys,
  getCachedBookmarkMetadata,
  useBookmarkList,
} from '../../model/bookmarks.queries';
import type {
  Bookmark,
  BookmarkDraft,
  BookmarkFilters,
  BookmarkScope,
  BookmarkGroup,
  MutationResult,
  OperationResult,
  BookmarkKind,
} from '../../model/bookmarks.types';
import { bookmarkErrorKey, isUuid } from '../../model/bookmarks.validation';
import { BookmarkForm } from '../BookmarkForm';
import { BookmarkList } from '../BookmarkList';
import { BookmarkSearch } from '../BookmarkSearch';
import { GroupForm } from '../GroupForm';
import { DeleteConfirmation } from '../DeleteConfirmation';
import { GroupMenu } from '../GroupMenu';
import { PageCheckbox } from '../PageCheckbox/PageCheckbox';
import { BatchToolbar } from '../BatchToolbar/BatchToolbar';

type BookmarksWorkspaceProps = {
  scope: BookmarkScope;
  filters: BookmarkFilters;
  isCurrentSession: () => boolean;
  onFiltersChange: (filters: BookmarkFilters, replace?: boolean) => void;
  navigationKey?: string;
};
type FormState = { draft: BookmarkDraft; resourceId?: string };
type GroupFormState = { name: string; groupId?: string };
type GroupDeletionState = {
  group: BookmarkGroup;
  checkedErrorGeneration: number;
  isUnavailable: boolean;
};
type BatchContext = {
  ids: string[];
  targetGroupId: string | null;
  targetName: string;
  browsingKey: string;
};

export function BookmarksWorkspace({
  scope,
  filters,
  isCurrentSession,
  onFiltersChange: updateFilters,
  navigationKey,
}: BookmarksWorkspaceProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const list = useBookmarkList(scope, filters, isCurrentSession);
  const filterKey = JSON.stringify([filters.group, filters.q, filters.page]);
  const browsingKey = JSON.stringify([filterKey, navigationKey]);
  const [selection, setSelection] = useState<{
    browsingKey: string;
    ids: Set<string>;
    correctingTo?: string;
  }>({ browsingKey, ids: new Set<string>() });
  const [moveTarget, setMoveTarget] = useState('ungrouped');
  const [batchContext, setBatchContext] = useState<BatchContext | null>(null);
  const batchIntent = useRef<BatchContext | null>(null);
  const [isBatchRefreshing, setBatchRefreshing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isEditLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<unknown>(null);
  const [deletion, setDeletion] = useState<Bookmark | null>(null);
  const [note, setNote] = useState<Bookmark | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [isGroupFormOpen, setGroupFormOpen] = useState(false);
  const [groupDeletion, setGroupDeletion] = useState<GroupDeletionState | null>(null);
  const [isGroupDeletionOpen, setGroupDeletionOpen] = useState(false);
  const [isImpactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'stale' | 'selection-stale' | null>(null);
  const editRequest = useRef(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<HTMLElement | null>(null);
  const onFiltersChange = useCallback(
    (next: BookmarkFilters, replace?: boolean) => {
      setSelection({ browsingKey, ids: new Set() });
      if (replace === undefined) updateFilters(next);
      else updateFilters(next, replace);
    },
    [browsingKey, updateFilters],
  );

  function rememberFocus(bookmarkId?: string): void {
    focusTarget.current = bookmarkId
      ? (mainRef.current?.querySelector<HTMLElement>(`[data-bookmark-actions="${bookmarkId}"]`) ??
        null)
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  function restoreFocus(): void {
    if (focusTarget.current?.isConnected) focusTarget.current.focus();
    else mainRef.current?.querySelector<HTMLElement>('button')?.focus();
  }

  async function onSucceeded(result: MutationResult | OperationResult): Promise<void> {
    if (result.kind === 'batch_move') setSelection({ browsingKey, ids: new Set() });
    batchIntent.current = null;
    setBatchContext(null);
    setFormOpen(false);
    setForm(null);
    setDeletion(null);
    if (result.kind === 'group_delete')
      focusTarget.current = mainRef.current?.querySelector<HTMLElement>('button') ?? null;
    setGroupFormOpen(false);
    setGroupForm(null);
    setGroupDeletionOpen(false);
    setGroupDeletion(null);
    setFeedback('saved');
    try {
      await client.invalidateQueries({ queryKey: bookmarkKeys.scope(scope), refetchType: 'none' });
      if (result.kind === 'group_delete' && result.resource_id === filters.group) {
        const next = { ...filters, group: 'ungrouped' };
        onFiltersChange(next, true);
        await client.fetchQuery({
          queryKey: bookmarkKeys.list(scope, next),
          queryFn: async ({ signal }) => {
            const data = await bookmarksApi.list(next, signal);
            if (!isCurrentSession()) throw new Error('Session changed');
            return data;
          },
          retry: false,
          staleTime: 0,
        });
        return;
      }
      await client.refetchQueries(
        { queryKey: bookmarkKeys.scope(scope), type: 'active' },
        { throwOnError: true },
      );
    } catch {
      if (isCurrentSession()) setFeedback('stale');
    }
  }

  async function onFailed(kind: BookmarkKind): Promise<void> {
    const original = batchIntent.current;
    if (kind !== 'batch_move' || !original) return;
    const requestId = editRequest.current;
    setBatchRefreshing(true);
    setFeedback(null);
    try {
      await client.invalidateQueries({ queryKey: bookmarkKeys.scope(scope), refetchType: 'none' });
      const latest = await client.fetchQuery({
        queryKey: bookmarkKeys.list(scope, filters),
        queryFn: async ({ signal }) => {
          const result = await bookmarksApi.list(filters, signal);
          if (!isCurrentSession()) throw new Error('Session changed');
          return result;
        },
        retry: false,
        staleTime: 0,
      });
      if (
        !isCurrentSession() ||
        editRequest.current !== requestId ||
        batchIntent.current !== original
      )
        return;
      const valid = new Set(latest.list.map((bookmark) => bookmark.id));
      setSelection((current) =>
        current.browsingKey === browsingKey
          ? { ...current, ids: new Set([...current.ids].filter((id) => valid.has(id))) }
          : current,
      );
      batchIntent.current = null;
      setBatchContext(null);
    } catch {
      if (
        isCurrentSession() &&
        editRequest.current === requestId &&
        batchIntent.current === original
      )
        setFeedback('selection-stale');
    } finally {
      if (isCurrentSession() && editRequest.current === requestId) setBatchRefreshing(false);
    }
  }

  const operations = useBookmarkOperations(scope.userId, isCurrentSession, onSucceeded, onFailed);
  const data = list.data;
  const pageIds = new Set(data?.list.map((bookmark) => bookmark.id) ?? []);
  const selectedIds =
    selection.browsingKey === browsingKey || selection.correctingTo === filterKey
      ? new Set([...selection.ids].filter((id) => pageIds.has(id)))
      : new Set<string>();
  const correctingTo =
    data && data.page !== filters.page
      ? JSON.stringify([filters.group, filters.q, data.page])
      : undefined;
  // Retire old owners before rendering; only a server page correction carries the intersection.
  if (
    selection.browsingKey !== browsingKey ||
    selection.correctingTo !== correctingTo ||
    selectedIds.size !== selection.ids.size
  ) {
    setSelection({ browsingKey, ids: selectedIds, correctingTo });
  }
  const canSelect = Boolean(
    data &&
    data.page === filters.page &&
    !list.isFetching &&
    !list.isError &&
    !operations.isBlocked &&
    !isBatchRefreshing,
  );
  const isBatchBlocked = operations.operation?.kind === 'batch_move';
  const batchCount = isBatchBlocked && batchContext ? batchContext.ids.length : selectedIds.size;
  const target =
    isBatchBlocked && batchContext ? (batchContext.targetGroupId ?? 'ungrouped') : moveTarget;
  const groupMetadata = data ?? getCachedBookmarkMetadata(client, scope);
  const groups = groupMetadata?.groups ?? [];
  const selectedGroup = groups.find((group) => group.id === filters.group) ?? null;
  const needsImpactRefresh = Boolean(
    groupDeletion &&
    isApiError(operations.error) &&
    Number(operations.error.code) === 40912 &&
    groupDeletion.checkedErrorGeneration !== operations.errorGeneration,
  );
  const currentGroupName =
    filters.group === 'all'
      ? t('bookmarks.all')
      : filters.group === 'ungrouped'
        ? t('bookmarks.ungrouped')
        : (groups.find((group) => group.id === filters.group)?.name ?? t('bookmarks.groupField'));
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));

  useEffect(() => {
    if (!data || data.page === filters.page) return;
    const next = { ...filters, page: data.page };
    client.setQueryData(bookmarkKeys.list(scope, next), data);
    updateFilters(next, true);
  }, [client, data, filters, scope, updateFilters]);
  useEffect(() => {
    if (
      list.isError &&
      isApiError(list.error) &&
      Number(list.error.code) === 40410 &&
      isUuid(filters.group)
    )
      updateFilters({ ...filters, group: 'ungrouped', page: 1 }, true);
  }, [list.isError, list.error, filters, updateFilters]);
  useEffect(() => {
    const prefix = bookmarkKeys.scope(scope);
    return () => {
      void client.cancelQueries({ queryKey: prefix });
      client.removeQueries({ queryKey: prefix });
    };
  }, [client, scope]);

  function startAction(): boolean {
    if (operations.isBlockedNow()) return false;
    // Only the current intent may retain a draft or recovery target.
    editRequest.current++;
    operations.clearError();
    setForm(null);
    setFormOpen(false);
    setEditError(null);
    setEditLoading(false);
    setDeletion(null);
    setGroupForm(null);
    setGroupFormOpen(false);
    setGroupDeletion(null);
    setGroupDeletionOpen(false);
    setImpactError(false);
    setImpactLoading(false);
    batchIntent.current = null;
    setBatchContext(null);
    setBatchRefreshing(false);
    return true;
  }

  function toggleSelection(id: string, checked: boolean): void {
    if (!canSelect || !pageIds.has(id)) return;
    setSelection((current) => {
      const ids = new Set(
        current.browsingKey === browsingKey ? [...current.ids].filter((id) => pageIds.has(id)) : [],
      );
      if (checked) ids.add(id);
      else ids.delete(id);
      return { browsingKey, ids };
    });
  }

  function submitMove(): void {
    if (
      !canSelect ||
      selectedIds.size === 0 ||
      selectedIds.size > 10 ||
      (moveTarget !== 'ungrouped' && !groups.some((group) => group.id === moveTarget))
    )
      return;
    const original: BatchContext = {
      ids: [...selectedIds],
      targetGroupId: moveTarget === 'ungrouped' ? null : moveTarget,
      targetName:
        moveTarget === 'ungrouped'
          ? t('bookmarks.ungrouped')
          : (groups.find((group) => group.id === moveTarget)?.name ?? ''),
      browsingKey,
    };
    if (!startAction()) return;
    batchIntent.current = original;
    setBatchContext(original);
    void operations.submit({
      kind: 'batch_move',
      bookmarkIds: original.ids,
      targetGroupId: original.targetGroupId,
    });
  }

  function openCreate(): void {
    if (!startAction()) return;
    rememberFocus();
    setForm({
      draft: {
        title: '',
        url: '',
        note: '',
        group_id: null,
      },
    });
    setFormOpen(true);
  }

  async function openEdit(bookmark: Bookmark): Promise<void> {
    if (!startAction()) return;
    rememberFocus(bookmark.id);
    const requestId = editRequest.current;
    setFormOpen(true);
    setEditLoading(true);
    setEditError(null);
    try {
      const current = await client.fetchQuery({
        queryKey: bookmarkKeys.detail(scope, bookmark.id),
        queryFn: ({ signal }) => bookmarksApi.get(bookmark.id, signal),
        retry: false,
        staleTime: 0,
      });
      if (isCurrentSession() && editRequest.current === requestId)
        setForm({
          resourceId: current.id,
          draft: {
            title: current.title,
            url: current.url,
            note: current.note,
            group_id: current.group_id,
          },
        });
    } catch (failure) {
      if (isCurrentSession() && editRequest.current === requestId) setEditError(failure);
    } finally {
      if (isCurrentSession() && editRequest.current === requestId) setEditLoading(false);
    }
  }

  function openGroupForm(group?: BookmarkGroup): void {
    if (!startAction()) return;
    setGroupForm({ name: group?.name ?? '', groupId: group?.id });
    setGroupFormOpen(true);
  }

  function openGroupDeletion(group: BookmarkGroup): void {
    if (!startAction()) return;
    setGroupDeletion({ group, checkedErrorGeneration: -1, isUnavailable: false });
    setGroupDeletionOpen(true);
  }

  async function refreshGroupImpact(): Promise<void> {
    const target = groupDeletion;
    if (!target || isImpactLoading || operations.isBlocked) return;
    const requestId = editRequest.current;
    const errorGeneration = operations.errorGeneration;
    setImpactLoading(true);
    setImpactError(false);
    try {
      const all = { group: 'all', q: '', page: 1 };
      const latest = await client.fetchQuery({
        queryKey: bookmarkKeys.list(scope, all),
        queryFn: ({ signal }) => bookmarksApi.list(all, signal),
        retry: false,
        staleTime: 0,
      });
      if (!isCurrentSession() || editRequest.current !== requestId) return;
      const group = latest.groups.find((group) => group.id === target.group.id);
      setGroupDeletion((current) =>
        current === target
          ? {
              group: group ?? target.group,
              checkedErrorGeneration: errorGeneration,
              isUnavailable: !group,
            }
          : current,
      );
    } catch {
      if (isCurrentSession() && editRequest.current === requestId) setImpactError(true);
    } finally {
      if (isCurrentSession() && editRequest.current === requestId) setImpactLoading(false);
    }
  }

  return (
    <div
      ref={mainRef}
      className="mx-auto max-w-[var(--layout-max-width)] space-y-[var(--space-6)] px-[var(--space-4)] py-[var(--space-8)] md:px-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-4)]">
        <h1 className="text-[length:var(--text-page-title-size)] leading-[var(--text-page-title-line)] font-semibold">
          {t('bookmarks.heading')}
        </h1>
        <Button
          type="button"
          className="max-md:w-full max-md:min-h-[var(--control-hit-size)]"
          disabled={operations.isBlocked}
          onClick={openCreate}
        >
          {t('bookmarks.add')}
        </Button>
      </div>
      <div className="grid min-w-0 gap-[var(--space-6)] md:grid-cols-[192px_minmax(0,1fr)]">
        <aside className="hidden md:block">
          <p className="text-muted-foreground mb-[var(--space-2)] text-xs">
            {t('bookmarks.groupField')}
          </p>
          <nav aria-label={t('bookmarks.groupsLabel')} className="space-y-[var(--space-1)]">
            {[
              { id: 'all', name: t('bookmarks.all'), count: groupMetadata?.all_count },
              {
                id: 'ungrouped',
                name: t('bookmarks.ungrouped'),
                count: groupMetadata?.ungrouped_count,
              },
              ...groups,
            ].map((group) => (
              <div key={group.id} className="flex min-w-0 items-center">
                <button
                  type="button"
                  aria-current={filters.group === group.id ? 'page' : undefined}
                  className={cn(
                    'hover:bg-surface-hover focus-visible:ring-ring flex min-h-[var(--control-hit-size)] min-w-0 flex-1 items-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] text-left text-sm focus-visible:ring-2 focus-visible:outline-none',
                    filters.group === group.id && 'bg-primary-subtle text-foreground font-semibold',
                  )}
                  onClick={() => onFiltersChange({ ...filters, group: group.id, page: 1 })}
                >
                  <Folder size={16} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  {group.count !== undefined ? (
                    <span className="text-muted-foreground text-xs">{group.count}</span>
                  ) : null}
                </button>
                {isUuid(group.id) && typeof group.count === 'number' ? (
                  <GroupMenu
                    group={{ id: group.id, name: group.name, count: group.count }}
                    isBlocked={operations.isBlocked}
                    onCreate={() => openGroupForm()}
                    onRename={openGroupForm}
                    onDelete={openGroupDeletion}
                    onFocusTarget={(element) => {
                      focusTarget.current = element;
                    }}
                  />
                ) : null}
              </div>
            ))}
          </nav>
          <Button
            type="button"
            variant="ghost"
            disabled={operations.isBlocked}
            className="mt-[var(--space-2)] w-full justify-start"
            onClick={() => {
              rememberFocus();
              openGroupForm();
            }}
          >
            {t('bookmarks.createGroup')}
          </Button>
        </aside>
        <section
          className="min-w-0 space-y-[var(--space-4)]"
          aria-label={t('bookmarks.resultsLabel')}
        >
          <div className="md:hidden">
            <Select
              value={filters.group}
              onValueChange={(group) => onFiltersChange({ ...filters, group, page: 1 })}
            >
              <SelectTrigger
                aria-label={t('bookmarks.groupsLabel')}
                className="min-h-[var(--control-hit-size)]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('bookmarks.all')} {groupMetadata?.all_count}
                </SelectItem>
                <SelectItem value="ungrouped">
                  {t('bookmarks.ungrouped')} {groupMetadata?.ungrouped_count}
                </SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name} · {group.count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden items-center gap-[var(--space-2)] md:flex">
            <h2 className="font-semibold">{currentGroupName}</h2>
            {data ? (
              <span className="text-muted-foreground text-xs">
                {t('bookmarks.total', { count: data.total })}
              </span>
            ) : null}
          </div>
          <BookmarkSearch
            key={filters.q}
            q={filters.q}
            onSearch={(q) => onFiltersChange({ ...filters, q, page: 1 })}
          />
          {data ? (
            <PageCheckbox
              label={t('bookmarks.selectPage', { count: data.list.length })}
              checked={selectedIds.size > 0 && selectedIds.size === data.list.length}
              isIndeterminate={selectedIds.size > 0 && selectedIds.size < data.list.length}
              disabled={!canSelect || data.list.length === 0}
              onChange={(checked) => {
                if (canSelect)
                  setSelection({ browsingKey, ids: checked ? new Set(pageIds) : new Set() });
              }}
            >
              <span className="text-sm">
                {t('bookmarks.selectPage', { count: data.list.length })}
              </span>
            </PageCheckbox>
          ) : null}
          {selectedIds.size > 0 || batchContext ? (
            <BatchToolbar
              count={batchCount}
              groups={groups}
              target={target}
              targetName={isBatchBlocked ? batchContext?.targetName : undefined}
              disabled={
                operations.isBlocked || isBatchRefreshing || list.isFetching || list.isError
              }
              isCancelDisabled={operations.isBlocked}
              isPending={Boolean(isBatchBlocked && operations.operation?.status === 'pending')}
              canMove={
                canSelect &&
                selectedIds.size > 0 &&
                (moveTarget === 'ungrouped' || groups.some((group) => group.id === moveTarget))
              }
              onTargetChange={(value) => {
                if (!operations.isBlocked && !isBatchRefreshing) {
                  operations.clearError();
                  setMoveTarget(value);
                }
              }}
              onMove={submitMove}
              onCancel={() => {
                if (operations.isBlocked) return;
                setSelection({ browsingKey, ids: new Set() });
                batchIntent.current = null;
                setBatchContext(null);
                operations.clearError();
              }}
            />
          ) : null}
          <div aria-live="polite" className="space-y-[var(--space-3)]">
            {groupForm && !isGroupFormOpen && (operations.operation || operations.error) ? (
              <Button type="button" variant="outline" onClick={() => setGroupFormOpen(true)}>
                {t('bookmarks.resumeDraft')}
              </Button>
            ) : null}
            {groupDeletion && !isGroupDeletionOpen && (operations.operation || operations.error) ? (
              <Button type="button" variant="outline" onClick={() => setGroupDeletionOpen(true)}>
                {t('bookmarks.resumeGroupDeletion')}
              </Button>
            ) : null}
            {form && !isFormOpen && (operations.operation || operations.error) ? (
              <Button type="button" variant="outline" onClick={() => setFormOpen(true)}>
                {t('bookmarks.resumeDraft')}
              </Button>
            ) : null}
            {operations.operation ? (
              <div
                role="status"
                className="bg-warning-subtle text-foreground flex flex-wrap items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-control)] p-[var(--space-4)]"
              >
                <p>
                  {t(
                    operations.operation.status === 'pending'
                      ? 'bookmarks.saving'
                      : 'bookmarks.unknown',
                  )}
                </p>
                {operations.operation.status === 'unknown' ? (
                  <Button
                    type="button"
                    variant="outline"
                    loading={operations.isResolving}
                    onClick={() => void operations.resolve()}
                  >
                    {t('bookmarks.resolve')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {operations.error && !operations.operation ? (
              <p role="alert" className="text-destructive">
                {t(bookmarkErrorKey(operations.error))}
              </p>
            ) : null}
            {feedback ? (
              <p role="status" className={feedback === 'saved' ? 'text-success' : 'text-warning'}>
                {t(
                  feedback === 'stale'
                    ? 'bookmarks.savedStale'
                    : feedback === 'selection-stale'
                      ? 'bookmarks.selectionRefreshFailed'
                      : 'bookmarks.saved',
                )}
              </p>
            ) : null}
            {list.isError ? (
              <div
                role="alert"
                className="bg-destructive-subtle flex flex-wrap items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-control)] p-[var(--space-4)]"
              >
                <p>{t(data ? 'bookmarks.refreshFailed' : 'bookmarks.loadFailed')}</p>
                <Button
                  type="button"
                  variant="outline"
                  loading={list.isFetching}
                  onClick={() => {
                    setFeedback(null);
                    void list.refetch();
                  }}
                >
                  {t('bookmarks.reload')}
                </Button>
              </div>
            ) : null}
          </div>
          {list.isPending ? (
            <div
              aria-busy="true"
              role="status"
              aria-label={t('bookmarks.loading')}
              className="space-y-[var(--space-3)]"
            >
              <span className="sr-only">{t('bookmarks.loading')}</span>
              {[1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-24 w-full" />
              ))}
            </div>
          ) : null}
          {data && data.total === 0 ? (
            <div className="bg-card space-y-[var(--space-4)] rounded-[var(--radius-card)] p-[var(--panel-padding-lg)]">
              <h3>
                {t(
                  filters.q
                    ? 'bookmarks.emptySearch'
                    : data.all_count === 0
                      ? 'bookmarks.emptyFirst'
                      : 'bookmarks.emptyGroup',
                )}
              </h3>
              <p className="text-muted-foreground">
                {t(filters.q ? 'bookmarks.emptySearchDescription' : 'bookmarks.emptyDescription')}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={!filters.q && operations.isBlocked}
                onClick={() =>
                  filters.q ? onFiltersChange({ ...filters, q: '', page: 1 }) : openCreate()
                }
              >
                {t(filters.q ? 'bookmarks.clearSearch' : 'bookmarks.add')}
              </Button>
            </div>
          ) : null}
          {data && data.total > 0 ? (
            <BookmarkList
              bookmarks={data.list}
              groups={groups}
              selectedIds={selectedIds}
              isSelectionDisabled={!canSelect}
              onSelectionChange={toggleSelection}
              isBlocked={operations.isBlocked}
              onEdit={(bookmark) => void openEdit(bookmark)}
              onDelete={(bookmark) => {
                if (!startAction()) return;
                rememberFocus(bookmark.id);
                setDeletion(bookmark);
              }}
              onNote={(bookmark) => {
                rememberFocus();
                setNote(bookmark);
              }}
            />
          ) : null}
          {data ? (
            <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
              <p className="text-muted-foreground text-xs">
                {t('bookmarks.pageStatus', {
                  page: data.page,
                  pages: totalPages,
                  count: data.total,
                })}
              </p>
              <div className="flex gap-[var(--space-2)]">
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.page <= 1 || list.isFetching}
                  onClick={() => onFiltersChange({ ...filters, page: data.page - 1 })}
                >
                  {t('bookmarks.previous')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.page >= totalPages || list.isFetching}
                  onClick={() => onFiltersChange({ ...filters, page: data.page + 1 })}
                >
                  {t('bookmarks.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <div className="md:hidden">
        <GroupMenu
          group={selectedGroup}
          isMobile
          isBlocked={operations.isBlocked}
          onCreate={() => openGroupForm()}
          onRename={openGroupForm}
          onDelete={openGroupDeletion}
          onFocusTarget={(element) => {
            focusTarget.current = element;
          }}
        />
      </div>
      {groupForm ? (
        <GroupForm
          open={isGroupFormOpen}
          name={groupForm.name}
          groupId={groupForm.groupId}
          groups={groups}
          isBlocked={operations.isBlocked}
          isPending={operations.operation?.status === 'pending'}
          isUnknown={operations.operation?.status === 'unknown'}
          isResolving={operations.isResolving}
          error={operations.error}
          onNameChange={(name) => {
            operations.clearError();
            setGroupForm({ ...groupForm, name });
          }}
          onOpenChange={(open) => {
            setGroupFormOpen(open);
            if (!open && !operations.isBlocked) setGroupForm(null);
          }}
          onRestoreFocus={restoreFocus}
          onSubmit={(name) =>
            void operations.submit({
              kind: groupForm.groupId ? 'group_rename' : 'group_create',
              resourceId: groupForm.groupId,
              groupName: name,
            })
          }
          onResolve={() => void operations.resolve()}
        />
      ) : null}
      {form ? (
        <BookmarkForm
          open={isFormOpen}
          isEditing={Boolean(form.resourceId)}
          draft={form.draft}
          groups={groups}
          isBlocked={operations.isBlocked}
          isPending={operations.operation?.status === 'pending'}
          error={operations.error}
          isUnknown={operations.operation?.status === 'unknown'}
          isResolving={operations.isResolving}
          onResolve={() => void operations.resolve()}
          onRestoreFocus={restoreFocus}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open && !operations.isBlocked) setForm(null);
          }}
          onDraftChange={(draft) => {
            operations.clearError();
            setForm({ ...form, draft });
          }}
          onSubmit={(draft) =>
            void operations.submit({
              kind: form.resourceId ? 'bookmark_update' : 'bookmark_create',
              resourceId: form.resourceId,
              draft,
            })
          }
        />
      ) : (
        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent
            closeLabel={t('bookmarks.close')}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreFocus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('bookmarks.edit')}</DialogTitle>
              <DialogDescription>{t('bookmarks.editDescription')}</DialogDescription>
            </DialogHeader>
            {isEditLoading ? (
              <p role="status">{t('bookmarks.loading')}</p>
            ) : editError ? (
              <p role="alert">{t(bookmarkErrorKey(editError))}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {t('bookmarks.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {deletion ? (
        <DeleteConfirmation
          kind="bookmark"
          target={deletion}
          open
          isBlocked={operations.isBlocked}
          isPending={operations.operation?.status === 'pending'}
          isUnknown={operations.operation?.status === 'unknown'}
          isResolving={operations.isResolving}
          error={operations.error}
          onOpenChange={(open) => {
            if (!open) setDeletion(null);
          }}
          onRestoreFocus={restoreFocus}
          onConfirm={() =>
            void operations.submit({ kind: 'bookmark_delete', resourceId: deletion.id })
          }
          onResolve={() => void operations.resolve()}
        />
      ) : groupDeletion ? (
        <DeleteConfirmation
          kind="group"
          target={groupDeletion.group}
          open={isGroupDeletionOpen}
          isBlocked={operations.isBlocked}
          isPending={operations.operation?.status === 'pending'}
          isUnknown={operations.operation?.status === 'unknown'}
          isResolving={operations.isResolving}
          error={operations.error}
          impact={{
            isLoading: isImpactLoading,
            needsRefresh: needsImpactRefresh,
            hasRefreshed:
              groupDeletion.checkedErrorGeneration >= 0 &&
              groupDeletion.checkedErrorGeneration === operations.errorGeneration &&
              !needsImpactRefresh,
            isUnavailable: groupDeletion.isUnavailable,
            hasError: impactError,
          }}
          onOpenChange={(open) => {
            setGroupDeletionOpen(open);
            if (!open && !operations.isBlocked) setGroupDeletion(null);
          }}
          onRestoreFocus={restoreFocus}
          onConfirm={() => {
            if (!needsImpactRefresh && !isImpactLoading && !groupDeletion.isUnavailable)
              void operations.submit({
                kind: 'group_delete',
                resourceId: groupDeletion.group.id,
                expectedCount: groupDeletion.group.count,
              });
          }}
          onRefreshImpact={() => void refreshGroupImpact()}
          onResolve={() => void operations.resolve()}
        />
      ) : null}
      <Dialog
        open={Boolean(note)}
        onOpenChange={(open) => {
          if (!open) setNote(null);
        }}
      >
        <DialogContent
          closeLabel={t('bookmarks.close')}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          className="max-h-[calc(100dvh-var(--space-8))] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {note?.title} · {t('bookmarks.noteField')}
            </DialogTitle>
            <DialogDescription>{t('bookmarks.noteDescription')}</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {note?.note || t('bookmarks.noNote')}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
