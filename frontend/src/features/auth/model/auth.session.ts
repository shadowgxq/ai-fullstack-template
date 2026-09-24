import { authGateway } from './auth.source';
import { useAuthStore } from './auth.store';

/** Refresh persisted user details without logging out on transient network failures. */
export async function revalidateSession(): Promise<void> {
  const { token } = useAuthStore.getState();
  if (!token || !authGateway.getMe) return;

  try {
    const user = await authGateway.getMe();
    if (useAuthStore.getState().token === token) {
      useAuthStore.getState().setSession(token, user);
    }
  } catch {
    // Authenticated 401 responses are handled by the request interceptor.
  }
}
