import { normalizeApiError, request, type RequestConfig } from '../../../shared/api';
import type {
  Bookmark,
  BookmarkGroup,
  BookmarkIntent,
  BookmarkListResult,
  MutationResult,
  OperationResult,
  BookmarkFilters,
  BookmarkKind,
} from './bookmarks.types';
import { isBookmarkKind, isSafeBookmarkUrl, isUuid } from './bookmarks.validation';

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid bookmark response');
  return Object.fromEntries(Object.entries(value));
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid bookmark count');
  return value;
}

function nullableId(value: unknown): string | null {
  if (value === null || isUuid(value)) return value;
  throw new Error('Invalid bookmark identity');
}

function parseBookmark(value: unknown): Bookmark {
  const dto = record(value);
  if (
    !isUuid(dto.id) ||
    typeof dto.title !== 'string' ||
    typeof dto.url !== 'string' ||
    !isSafeBookmarkUrl(dto.url) ||
    typeof dto.note !== 'string' ||
    typeof dto.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(dto.updated_at))
  )
    throw new Error('Invalid bookmark');
  return {
    id: dto.id,
    title: dto.title,
    url: dto.url,
    note: dto.note,
    group_id: nullableId(dto.group_id),
    updated_at: dto.updated_at,
  };
}

async function call(config: RequestConfig): Promise<unknown> {
  const result = record(await request<unknown>(config));
  if (result.code !== 0)
    throw normalizeApiError({
      __apiError: true,
      message: typeof result.message === 'string' ? result.message : 'Invalid bookmark response',
      messageFromServer: typeof result.message === 'string',
      code: typeof result.code === 'number' ? result.code : undefined,
      details: result.data,
    });
  return result.data;
}

function isValidSuccess(
  kind: BookmarkKind,
  resourceId: string | null,
  changedCount: number,
): boolean {
  if (kind === 'batch_move') return resourceId === null && changedCount <= 10;
  return resourceId !== null && (kind === 'group_delete' || changedCount === 1);
}

function parseMutation(value: unknown, operationId: string): MutationResult {
  const dto = record(value);
  if (dto.operation_id !== operationId) throw new Error('Invalid bookmark receipt');
  const kind = dto.kind;
  if (!isBookmarkKind(kind)) throw new Error('Invalid bookmark kind');
  const resourceId = nullableId(dto.resource_id);
  const changedCount = count(dto.changed_count);
  if (!isValidSuccess(kind, resourceId, changedCount))
    throw new Error('Invalid bookmark success receipt');
  return { operation_id: operationId, kind, resource_id: resourceId, changed_count: changedCount };
}

export const bookmarksApi = {
  async list(filters: BookmarkFilters, signal?: AbortSignal): Promise<BookmarkListResult> {
    const dto = record(
      await call({ method: 'GET', url: '/v1/bookmarks', params: filters, signal }),
    );
    if (
      !Array.isArray(dto.list) ||
      !Array.isArray(dto.groups) ||
      dto.page_size !== 10 ||
      count(dto.page) < 1
    )
      throw new Error('Invalid bookmark list');
    const groups: BookmarkGroup[] = dto.groups.map((value: unknown) => {
      const group = record(value);
      if (!isUuid(group.id) || typeof group.name !== 'string')
        throw new Error('Invalid bookmark group');
      return { id: group.id, name: group.name, count: count(group.count) };
    });
    return {
      list: dto.list.map(parseBookmark),
      groups,
      total: count(dto.total),
      page: count(dto.page),
      page_size: 10,
      all_count: count(dto.all_count),
      ungrouped_count: count(dto.ungrouped_count),
    };
  },
  async get(id: string, signal?: AbortSignal): Promise<Bookmark> {
    return parseBookmark(await call({ method: 'GET', url: `/v1/bookmarks/${id}`, signal }));
  },
  async mutate(intent: BookmarkIntent): Promise<MutationResult> {
    if (intent.kind === 'batch_move') {
      const ids = intent.bookmarkIds;
      if (
        !ids ||
        ids.length < 1 ||
        ids.length > 10 ||
        ids.some((id) => !isUuid(id)) ||
        new Set(ids.map((id) => id.toLowerCase())).size !== ids.length ||
        (intent.targetGroupId !== null && !isUuid(intent.targetGroupId))
      )
        throw new Error('Invalid batch move intent');
      const result = parseMutation(
        await call({
          method: 'POST',
          url: '/v1/bookmarks/batch-move',
          data: { bookmark_ids: [...ids], target_group_id: intent.targetGroupId },
          headers: { 'Idempotency-Key': intent.operationId },
        }),
        intent.operationId,
      );
      if (result.changed_count > ids.length) throw new Error('Invalid batch move count');
      return result;
    }
    const isGroup =
      intent.kind === 'group_create' ||
      intent.kind === 'group_rename' ||
      intent.kind === 'group_delete';
    const isCreating = intent.kind === 'bookmark_create' || intent.kind === 'group_create';
    const result = await call({
      method: isCreating
        ? 'POST'
        : intent.kind === 'bookmark_update'
          ? 'PUT'
          : intent.kind === 'group_rename'
            ? 'PATCH'
            : 'DELETE',
      url: `/v1/${isGroup ? 'bookmark-groups' : 'bookmarks'}${isCreating ? '' : `/${intent.resourceId}`}`,
      data: isGroup
        ? intent.kind === 'group_delete'
          ? undefined
          : { name: intent.groupName }
        : intent.draft,
      ...(intent.kind === 'group_delete'
        ? { params: { expected_count: intent.expectedCount } }
        : {}),
      headers: { 'Idempotency-Key': intent.operationId },
    });
    return parseMutation(result, intent.operationId);
  },
  async resolve(operationId: string): Promise<OperationResult> {
    const dto = record(
      await call({ method: 'POST', url: `/v1/bookmark-operations/${operationId}/resolve` }),
    );
    if (
      dto.operation_id !== operationId ||
      (dto.status !== 'succeeded' && dto.status !== 'failed' && dto.status !== 'not_executed')
    )
      throw new Error('Invalid operation resolution');
    const kind = dto.kind;
    if (kind !== null && !isBookmarkKind(kind)) throw new Error('Invalid operation kind');
    if (
      dto.error_code !== null &&
      (typeof dto.error_code !== 'number' || !Number.isSafeInteger(dto.error_code))
    )
      throw new Error('Invalid operation error');
    const resourceId = nullableId(dto.resource_id);
    const changedCount = count(dto.changed_count);
    if (
      dto.status === 'not_executed' &&
      (kind !== null || resourceId !== null || changedCount !== 0 || dto.error_code !== null)
    )
      throw new Error('Invalid cancellation receipt');
    if (
      dto.status === 'failed' &&
      (kind === null || resourceId !== null || changedCount !== 0 || dto.error_code === null)
    )
      throw new Error('Invalid failure receipt');
    if (
      dto.status === 'succeeded' &&
      (kind === null || !isValidSuccess(kind, resourceId, changedCount) || dto.error_code !== null)
    )
      throw new Error('Invalid success receipt');
    return {
      operation_id: operationId,
      status: dto.status,
      kind,
      error_code: dto.error_code,
      resource_id: resourceId,
      changed_count: changedCount,
    };
  },
};
