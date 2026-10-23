import { queryOptions } from '@tanstack/react-query';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { api } from '../../shared/api/gateway';
import { ApiError, abortError } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';

export function profileQueryOptions(session: AuthSession | null) {
  return queryOptions({
    queryKey: sessionQueryKey(session, 'profile'),
    enabled: Boolean(session),
    queryFn: async ({ signal }) => {
      if (!session || getAuthSession() !== session || signal.aborted) throw abortError();
      const profile = await api.profile(signal);
      if (getAuthSession() !== session || signal.aborted) throw abortError();
      if (profile.user_id !== session.userId)
        throw new ApiError('个人资料账户不匹配', 'invalid-response');
      return profile;
    },
  });
}
