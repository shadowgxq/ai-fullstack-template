import { isApiError } from '../../../shared/api';
import { BOOKMARK_OPERATION_KINDS } from './bookmarks.constants';
import type {
  BookmarkDraft,
  BookmarkFieldErrors,
  BookmarkFilters,
  BookmarkKind,
} from './bookmarks.types';

export function isBookmarkKind(value: unknown): value is BookmarkKind {
  return typeof value === 'string' && BOOKMARK_OPERATION_KINDS.some((kind) => kind === value);
}

export function validateGroupName(value: string): string | null {
  const name = value.trim();
  if (name.includes(String.fromCharCode(0))) return 'bookmarks.errors.characters';
  if (Array.from(name).length < 1 || Array.from(name).length > 30)
    return 'bookmarks.errors.groupName';
  if (name === '全部' || name === '未分组') return 'bookmarks.errors.reservedGroup';
  return null;
}

export function groupNameError(error: unknown): string | null {
  if (!isApiError(error)) return null;
  if (Number(error.code) === 40910) return 'bookmarks.errors.groupDuplicate';
  if (Number(error.code) !== 42200 || !Array.isArray(error.details)) return null;
  for (const item of error.details) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('loc' in item) ||
      !Array.isArray(item.loc) ||
      item.loc.at(-1) !== 'name'
    )
      continue;
    return 'msg' in item && typeof item.msg === 'string' && item.msg.includes('NUL characters')
      ? 'bookmarks.errors.characters'
      : 'bookmarks.errors.groupName';
  }
  return null;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  );
}

export function isSafeBookmarkUrl(value: string): boolean {
  if (
    !/^https?:\/\//i.test(value) ||
    Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateBookmark(draft: BookmarkDraft): BookmarkFieldErrors {
  const errors: BookmarkFieldErrors = {};
  const titleLength = Array.from(draft.title.trim()).length;
  if (titleLength < 1 || titleLength > 80) errors.title = 'bookmarks.errors.title';
  const url = draft.url.trim();
  if (!isSafeBookmarkUrl(url) || Array.from(url).length > 2048) errors.url = 'bookmarks.errors.url';
  if (Array.from(draft.note).length > 500) errors.note = 'bookmarks.errors.note';
  if (draft.title.includes(String.fromCharCode(0))) errors.title = 'bookmarks.errors.characters';
  if (draft.note.includes(String.fromCharCode(0))) errors.note = 'bookmarks.errors.characters';
  if (draft.group_id !== null && !isUuid(draft.group_id))
    errors.group_id = 'bookmarks.errors.group';
  return errors;
}

export function normalizeBookmarkDraft(draft: BookmarkDraft): BookmarkDraft {
  return { ...draft, title: draft.title.trim(), url: draft.url.trim() };
}

export function parseBookmarkFilters(params: URLSearchParams): BookmarkFilters {
  const group = params.get('group') ?? 'all';
  const page = Number(params.get('page') ?? 1);
  return {
    group: group === 'all' || group === 'ungrouped' || isUuid(group) ? group : 'all',
    q: (params.get('q') ?? '').trim(),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

/** Only a trusted terminal rejection unlocks a new submission intent. */
export function isTerminalBookmarkError(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.messageFromServer &&
    [40000, 40100, 40101, 40300, 40410, 40910, 40911, 40912, 40913, 40914, 42200].includes(
      Number(error.code),
    ) &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}

export function bookmarkErrorKey(error: unknown): string {
  if (!isApiError(error)) return 'bookmarks.errors.generic';
  if (Number(error.code) === 40410) return 'bookmarks.errors.unavailable';
  if (Number(error.code) === 40911) return 'bookmarks.errors.keyConflict';
  if (Number(error.code) === 40910) return 'bookmarks.errors.groupDuplicate';
  if (Number(error.code) === 40912) return 'bookmarks.errors.groupCountChanged';
  if (Number(error.code) === 40913) return 'bookmarks.errors.notExecuted';
  if (Number(error.code) === 40914) return 'bookmarks.errors.moveUnavailable';
  return 'bookmarks.errors.generic';
}

export function bookmarkFieldErrors(error: unknown): BookmarkFieldErrors {
  if (!isApiError(error) || Number(error.code) !== 42200 || !Array.isArray(error.details))
    return {};
  const errors: BookmarkFieldErrors = {};
  for (const item of error.details) {
    if (typeof item !== 'object' || item === null || !('loc' in item) || !Array.isArray(item.loc))
      continue;
    const field: unknown = item.loc[item.loc.length - 1];
    if (field === 'title' || field === 'url' || field === 'note')
      errors[field] = `bookmarks.errors.${field}`;
    if (
      (field === 'title' || field === 'note') &&
      'type' in item &&
      item.type === 'value_error' &&
      'msg' in item &&
      typeof item.msg === 'string' &&
      item.msg.includes('NUL characters')
    )
      errors[field] = 'bookmarks.errors.characters';
    if (field === 'group_id') errors.group_id = 'bookmarks.errors.group';
  }
  return errors;
}
