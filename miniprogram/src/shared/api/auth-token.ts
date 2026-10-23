import Taro from '@tarojs/taro';
import { abortError, isRecord } from './errors';

const storageKey = 'fullstack.miniprogram.session.v2';
const logoutKey = 'fullstack.miniprogram.signed-out.v1';
const legacyTokenKey = 'fullstack.miniprogram.access-token.v1';

export interface AuthSession {
  readonly token: string;
  readonly userId: number;
  readonly generation: number;
}

let currentSession: AuthSession | null = null;
let generation = 0;
let hydrated = false;
let restorationBlocked = false;
let unauthorizedHandler: (() => void) | null = null;
const listeners = new Set<() => void>();
const cleanupListeners = new Set<() => void>();

function publishSession(session: { token: string; userId: number } | null): void {
  generation += 1;
  currentSession = session ? { ...session, generation } : null;
  for (const cleanup of cleanupListeners) cleanup();
  for (const listener of listeners) listener();
}

export function subscribeAuthToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 查询、草稿和临时图片缓存的拥有者在会话切换时清理自己的状态。 */
export function onSessionChange(cleanup: () => void): () => void {
  cleanupListeners.add(cleanup);
  return () => {
    cleanupListeners.delete(cleanup);
  };
}

export function hydrateAuthToken(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    if (restorationBlocked || Taro.getStorageSync(logoutKey)) return;
    const stored: unknown = Taro.getStorageSync(storageKey);
    // v1 只有 token，没有可信账户标识；不能将其恢复成任意账户的会话。
    if (
      isRecord(stored) &&
      typeof stored.token === 'string' &&
      stored.token.trim() &&
      typeof stored.userId === 'number' &&
      Number.isSafeInteger(stored.userId) &&
      stored.userId > 0
    ) {
      publishSession({ token: stored.token, userId: stored.userId });
    }
  } catch {
    restorationBlocked = true;
    throw new Error('无法读取本地登录状态，请重新登录');
  }
}

export function getAuthSession(): AuthSession | null {
  return currentSession;
}

export function getAuthToken(): string | null {
  return currentSession?.token ?? null;
}

export function getSessionGeneration(): number {
  return generation;
}

export function isCurrentSession(
  session: AuthSession | null,
  expectedGeneration = generation,
): boolean {
  return session === currentSession && expectedGeneration === generation;
}

/** 先写保护标记，再写凭据；只有整组持久化成功才发布登录态。 */
export function saveAuthSession(
  token: string,
  userId: number,
  expectedGeneration = generation,
): void {
  if (expectedGeneration !== generation) throw abortError();
  if (!token.trim() || !Number.isSafeInteger(userId) || userId <= 0)
    throw new Error('登录凭据或账户标识无效');
  try {
    Taro.setStorageSync(logoutKey, true);
    Taro.setStorageSync(storageKey, { token, userId });
    Taro.removeStorageSync(logoutKey);
  } catch {
    restorationBlocked = true;
    // 部分写入失败时尽力留保护标记并清理凭据，绝不发布新登录。
    try {
      Taro.setStorageSync(logoutKey, true);
    } catch {
      /* 存储完全不可写时仍尝试删除，并保留本进程恢复禁用。 */
    }
    try {
      Taro.removeStorageSync(storageKey);
    } catch {
      /* 已持久化的保护标记仍独立阻止恢复。 */
    }
    publishSession(null);
    throw new Error('无法保存登录状态，请检查存储后重试');
  }
  hydrated = true;
  restorationBlocked = false;
  publishSession({ token, userId });
}

/** expectedSession 防止旧退出请求清理后来完成的新登录。 */
export function clearAuthToken(expectedSession?: AuthSession | null): void {
  if (expectedSession !== undefined && expectedSession !== currentSession) return;
  restorationBlocked = true;
  hydrated = true;
  let markerWritten = false;
  let tokenRemoved = false;
  try {
    Taro.setStorageSync(logoutKey, true);
    markerWritten = true;
  } catch {
    /* 删除凭据成功也可防止恢复；两者均失败时须明确说明。 */
  }
  try {
    Taro.removeStorageSync(storageKey);
    Taro.removeStorageSync(legacyTokenKey);
    tokenRemoved = true;
  } catch {
    /* 保护标记可独立于凭据删除生效。 */
  } finally {
    publishSession(null);
  }
  if (!markerWritten && !tokenRemoved)
    throw new Error('当前页面已退出，但无法持久清理登录状态；请清理小程序存储后重新使用');
  if (!markerWritten || !tokenRemoved)
    throw new Error('当前页面已退出，本地登录存储未能完整清理，请重试');
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(requestSession: AuthSession | null): void {
  if (!requestSession || requestSession !== currentSession) return;
  try {
    clearAuthToken(requestSession);
  } finally {
    unauthorizedHandler?.();
  }
}
