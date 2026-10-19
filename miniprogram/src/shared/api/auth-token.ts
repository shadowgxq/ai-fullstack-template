import Taro from '@tarojs/taro';

const storageKey = 'fullstack.miniprogram.access-token.v1';
let currentToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
const listeners = new Set<() => void>();
function publishToken(): void {
  for (const listener of listeners) listener();
}
export function subscribeAuthToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hydrateAuthToken(): void {
  const value: unknown = Taro.getStorageSync(storageKey);
  currentToken = typeof value === 'string' && value.length > 0 ? value : null;
  publishToken();
}
export function getAuthToken(): string | null {
  return currentToken;
}

/** 存储失败不能被当作成功登录；内存只在落盘成功后切换。 */
export function saveAuthToken(token: string): void {
  if (!token.trim()) throw new Error('登录凭据为空');
  Taro.setStorageSync(storageKey, token);
  currentToken = token;
  publishToken();
}
export function clearAuthToken(): void {
  currentToken = null;
  publishToken();
  Taro.removeStorageSync(storageKey);
}
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(requestToken: string | null): void {
  if (!requestToken || requestToken !== currentToken) return;
  try {
    clearAuthToken();
  } finally {
    unauthorizedHandler?.();
  }
}
