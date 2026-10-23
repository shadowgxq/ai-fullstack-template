import '../platform/polyfills';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';
import { onSessionChange, type AuthSession } from '../api/auth-token';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        count < 1 &&
        error instanceof ApiError &&
        (error.kind === 'network' || (error.kind === 'http' && (error.status ?? 0) >= 500)),
    },
    mutations: { retry: false, networkMode: 'always' },
  },
});

onSessionChange(() => {
  void queryClient.cancelQueries();
  queryClient.clear();
});

export function sessionQueryKey(session: AuthSession | null, ...parts: readonly string[]) {
  return ['session', session?.userId ?? null, session?.generation ?? null, ...parts] as const;
}
