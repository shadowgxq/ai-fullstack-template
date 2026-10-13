import { useQuery, type QueryClient } from '@tanstack/react-query';

import { bookmarksApi } from './bookmarks.api';
import type { BookmarkFilters, BookmarkScope, BookmarkListResult } from './bookmarks.types';

/** Loading navigation may reuse private metadata, never rows from another filter. */
export function getCachedBookmarkMetadata(
  client: QueryClient,
  scope: BookmarkScope,
): Pick<BookmarkListResult, 'groups' | 'all_count' | 'ungrouped_count'> | undefined {
  const latest = client
    .getQueryCache()
    .findAll({ queryKey: [...bookmarkKeys.scope(scope), 'list'] })
    .filter((query) => query.state.data !== undefined)
    .sort((left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt)[0];
  const data = latest ? client.getQueryData<BookmarkListResult>(latest.queryKey) : undefined;
  return data
    ? { groups: data.groups, all_count: data.all_count, ungrouped_count: data.ungrouped_count }
    : undefined;
}

export const bookmarkKeys = {
  scope: (scope: BookmarkScope) => ['bookmarks', scope.userId, scope.generation] as const,
  list: (scope: BookmarkScope, filters: BookmarkFilters) =>
    [...bookmarkKeys.scope(scope), 'list', filters] as const,
  detail: (scope: BookmarkScope, id: string) =>
    [...bookmarkKeys.scope(scope), 'detail', id] as const,
};

export function useBookmarkList(
  scope: BookmarkScope,
  filters: BookmarkFilters,
  isCurrentSession: () => boolean,
) {
  return useQuery({
    queryKey: bookmarkKeys.list(scope, filters),
    queryFn: async ({ signal }) => {
      const result = await bookmarksApi.list(filters, signal);
      if (!isCurrentSession()) throw new Error('Session changed');
      return result;
    },
    retry: false,
  });
}
