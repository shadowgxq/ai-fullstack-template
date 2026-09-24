/** Module-level bridge keeps shared/api independent from the auth feature store. */
let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  try {
    unauthorizedHandler?.();
  } catch {
    // Session cleanup must not replace the original request error.
  }
}
