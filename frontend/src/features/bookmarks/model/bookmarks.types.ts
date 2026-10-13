export type Bookmark = {
  id: string;
  title: string;
  url: string;
  note: string;
  group_id: string | null;
  updated_at: string;
};

export type BookmarkGroup = { id: string; name: string; count: number };
export type BookmarkListResult = {
  list: Bookmark[];
  total: number;
  page: number;
  page_size: number;
  groups: BookmarkGroup[];
  all_count: number;
  ungrouped_count: number;
};
export type BookmarkDraft = Pick<Bookmark, 'title' | 'url' | 'note' | 'group_id'>;
export type BookmarkFilters = { group: string; q: string; page: number };
export type BookmarkScope = { userId: string; generation: number };
export type BookmarkKind =
  (typeof import('./bookmarks.constants').BOOKMARK_OPERATION_KINDS)[number];
export type MutationResult = {
  operation_id: string;
  kind: BookmarkKind;
  resource_id: string | null;
  changed_count: number;
};
export type OperationResult = Omit<MutationResult, 'kind'> & {
  kind: BookmarkKind | null;
  status: 'succeeded' | 'failed' | 'not_executed';
  error_code: number | null;
};
export type BookmarkIntent = {
  operationId: string;
  kind: BookmarkKind;
  resourceId?: string;
  draft?: BookmarkDraft;
  groupName?: string;
  expectedCount?: number;
  bookmarkIds?: string[];
  targetGroupId?: string | null;
};
export type BookmarkField = keyof BookmarkDraft;
export type BookmarkFieldErrors = Partial<Record<BookmarkField, string>>;
