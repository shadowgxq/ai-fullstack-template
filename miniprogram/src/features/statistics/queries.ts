import { infiniteQueryOptions } from '@tanstack/react-query';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { ApiError, abortError } from '../../shared/api/errors';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { shanghaiToday } from '../wear-history/date';
import { statisticsApi } from './api';

export class StatisticsCursorExpired extends ApiError {
  constructor() {
    super('统计数据已变化，请重新载入第一页', 'http', 409);
  }
}
export function statisticsQueryOptions(session: AuthSession | null, day = shanghaiToday()) {
  return infiniteQueryOptions({
    queryKey: sessionQueryKey(session, 'statistics', day),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      if (!session || getAuthSession() !== session || day !== shanghaiToday()) throw abortError();
      try {
        return await statisticsApi.read(pageParam, signal);
      } catch (error) {
        if (pageParam && error instanceof ApiError && error.status === 409)
          throw new StatisticsCursorExpired();
        throw error;
      }
    },
    getNextPageParam: (page) => page.garment_counts.next_cursor ?? undefined,
    enabled: Boolean(session),
  });
}
export async function recoverStatisticsCursor(
  session: AuthSession,
  error: unknown,
  day = shanghaiToday(),
): Promise<void> {
  if (!(error instanceof StatisticsCursorExpired) || getAuthSession() !== session) return;
  await queryClient.resetQueries({
    queryKey: sessionQueryKey(session, 'statistics', day),
    exact: true,
  });
}
