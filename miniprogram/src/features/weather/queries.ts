import { queryOptions } from '@tanstack/react-query';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { abortError, ApiError } from '../../shared/api/errors';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import type { Profile } from '../../shared/api/gateway';
import { weatherApi } from './api';
import { isWeatherDayCurrent } from './time';
export function weatherQueryOptions(
  session: AuthSession | null,
  cityId: string | null,
  day: string,
) {
  return queryOptions({
    queryKey: [...sessionQueryKey(session, 'weather'), cityId, day],
    enabled: Boolean(session),
    queryFn: async ({ signal }) => {
      if (!session || getAuthSession() !== session || signal.aborted) throw abortError();
      const value = await weatherApi.context({}, signal);
      if (getAuthSession() !== session || signal.aborted) throw abortError();
      if (
        value.weather_date !== day ||
        !isWeatherDayCurrent(value.weather_date, value.valid_until) ||
        (value.facts && Date.parse(value.facts.fetched_at) > Date.now())
      )
        throw new ApiError('天气日期已变化，请重新读取', 'invalid-response');
      if (value.selection_source !== 'saved' && value.selection_source !== 'default')
        throw new ApiError('天气城市来源与当前查询不匹配', 'invalid-response');
      if (value.selection_source === 'saved' && value.region.city_id !== cityId) throw abortError();
      return value;
    },
  });
}
export async function refreshCityFacts(session: AuthSession, profile: Profile): Promise<void> {
  if (getAuthSession() !== session) return;
  queryClient.setQueryData(sessionQueryKey(session, 'profile'), profile);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionQueryKey(session, 'profile'), exact: true }),
    queryClient.invalidateQueries({ queryKey: sessionQueryKey(session, 'weather') }),
  ]);
}
