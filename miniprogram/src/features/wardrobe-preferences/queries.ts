import { queryOptions } from '@tanstack/react-query';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { abortError } from '../../shared/api/errors';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { preferencesApi, type Preferences } from './api';
export function preferencesQueryOptions(session: AuthSession | null) {
  return queryOptions({
    queryKey: sessionQueryKey(session, 'preferences'),
    enabled: Boolean(session),
    queryFn: async ({ signal }) => {
      if (!session || signal.aborted || getAuthSession() !== session) throw abortError();
      const result = await preferencesApi.read(signal);
      if (signal.aborted || getAuthSession() !== session) throw abortError();
      return result;
    },
  });
}

export async function refreshPreferences(session: AuthSession, value: Preferences): Promise<void> {
  if (getAuthSession() !== session) return;
  queryClient.setQueryData(sessionQueryKey(session, 'preferences'), value);
  await queryClient.invalidateQueries({
    queryKey: sessionQueryKey(session, 'preferences'),
    exact: true,
  });
}
