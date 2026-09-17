import { isApiError } from '../../../shared/api';
import { authGateway } from './auth.source';
import { useAuthStore } from './auth.store';

/**
 * 应用启动时回源校验本地会话（GET /account/me）。
 * - 无本地 token 或数据源不支持（mock 未实现 getMe）→ 直接跳过。
 * - 成功 → 用服务端最新用户信息刷新 store（昵称/头像/角色可能已变）。
 * - 401 → 请求层拦截器已触发 notifyUnauthorized 清除会话，这里不再处理。
 * - 其他失败（网络抖动/5xx）→ 保留本地会话，避免离线时把用户登出。
 */
export async function revalidateSession(): Promise<void> {
  const { token } = useAuthStore.getState();
  const getMe = authGateway.getMe;
  if (!token || !getMe) {
    return;
  }
  try {
    const user = await getMe();
    useAuthStore.getState().setSession(token, user);
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return; // 会话已失效：拦截器已清除本地会话
    }
    // 非 401 一律静默保留本地会话
  }
}
