/**
 * 已登录用户的访问令牌持有处（供请求拦截器读取）。
 *
 * 放在 shared/api 而不是 feature 里，是为了让 requestClient 不反向依赖业务层：
 * auth 域负责在登录/登出/恢复时把 token 推进来（setAuthToken），requestClient 只读取。
 */

let authToken: string | null = null;

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * 401 处理回调：由 auth 域注册（清除本地会话）。
 * requestClient 在「带着 token 却收到 401」时调用，避免 shared 反向依赖业务层。
 */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
