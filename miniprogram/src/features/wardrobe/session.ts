import { useSyncExternalStore } from 'react';
import { getAuthSession, subscribeAuthToken } from '../../shared/api/auth-token';

export function useWardrobeSession() {
  return useSyncExternalStore(subscribeAuthToken, getAuthSession, getAuthSession);
}
