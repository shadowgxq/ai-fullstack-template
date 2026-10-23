import { api } from '../../shared/api/gateway';
import {
  clearAuthToken,
  getAuthSession,
  getSessionGeneration,
  saveAuthSession,
  type AuthSession,
} from '../../shared/api/auth-token';
import { abortError, errorMessage } from '../../shared/api/errors';
import { requestWeChatLoginCode } from '../../shared/platform/wechat';

export async function loginWithWeChat(signal?: AbortSignal): Promise<AuthSession> {
  const generation = getSessionGeneration();
  const assertActive = () => {
    if (signal?.aborted || getSessionGeneration() !== generation) throw abortError();
  };
  assertActive();
  let code: string;
  try {
    code = await requestWeChatLoginCode();
  } catch {
    assertActive();
    throw new Error('微信登录未完成，请重试');
  }
  assertActive();
  const result = await api.wechatLogin(code, signal);
  assertActive();
  saveAuthSession(result.access_token, result.user.id, generation);
  const session = getAuthSession();
  if (!session) throw abortError();
  return session;
}

/** 远端撤销失败仍退出本地；旧退出的 finally 不得碰新会话。 */
export async function logoutCurrentSession(): Promise<string | null> {
  const session = getAuthSession();
  let warning: string | null = null;
  if (session) {
    try {
      await api.logout();
    } catch {
      warning = '已退出本地登录，但尚未确认服务端撤销，请稍后重试';
    }
  }
  if (getAuthSession() !== session) return null;
  try {
    clearAuthToken(session);
  } catch (error) {
    warning = [warning, errorMessage(error)].filter(Boolean).join('；');
  }
  return warning;
}
