import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { wearApi, type WearFilters } from './api';

export function wearListQueryOptions(session: AuthSession | null, filters: WearFilters) {
  return infiniteQueryOptions({
    queryKey: [
      ...sessionQueryKey(session, 'wear-records'),
      filters.start_date ?? '',
      filters.end_date ?? '',
    ],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => wearApi.list(filters, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(session),
  });
}
export function wearRecordQueryOptions(session: AuthSession | null, id: string) {
  return queryOptions({
    queryKey: sessionQueryKey(session, 'wear-record', id),
    queryFn: ({ signal }) => wearApi.record(id, signal),
    enabled: Boolean(session && id),
  });
}
/** 历史写入影响事实聚合，后续统计/推荐也沿用相同账户前缀。 */
export async function invalidateWearFacts(session: AuthSession): Promise<void> {
  if (getAuthSession() !== session) return;
  await Promise.all(
    ['wear-records', 'wear-record', 'garment', 'statistics', 'recommendations'].map((domain) =>
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(session, domain) }),
    ),
  );
}
