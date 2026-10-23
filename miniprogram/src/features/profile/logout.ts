import {
  getAuthSession,
  getSessionGeneration,
  type AuthSession,
} from '../../shared/api/auth-token';
import { logoutCurrentSession } from '../auth/session';

/** 结果仅属于刚结束的原会话；后来登录不能收到旧退出反馈。 */
export async function logoutProfileSession(
  session: AuthSession,
): Promise<{ generation: number; warning: string | null } | null> {
  if (getAuthSession() !== session) return null;
  const before = getSessionGeneration();
  const warning = await logoutCurrentSession();
  if (getAuthSession() !== null || getSessionGeneration() !== before + 1) return null;
  return { generation: getSessionGeneration(), warning };
}
