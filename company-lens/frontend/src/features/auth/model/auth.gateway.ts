import type {
  AuthSession,
  AuthUser,
  EmailCodeLoginInput,
  GoogleLoginInput,
  PasswordLoginInput,
  RegisterInput,
  ResetPasswordInput,
  SendEmailCodeInput,
} from './auth.types';

/**
 * mock 与真实 API 共同实现的认证数据源接口；切换见 auth.source.ts。
 *
 * 账户口径（2026-08-05 按需求底稿恢复密码体系）：
 * - 邮箱验证码（登录注册二合一）与 Google 授权：后端契约已冻结并在 prod 验证；
 * - 邮箱密码注册/登录 + 验证码找回密码：需求底稿 18.4/18.5 的口径，后端接口尚未提供，
 *   api 数据源对这三个方法显式抛 CONTRACT_UNAVAILABLE，不臆造路径（msc 曾照自拟契约
 *   实现整套找回密码页面，最终因后端无此接口整体删除——见 c8f12c2）。
 *   契约请求见 docs/api/account-password-backend-gaps.md。
 * 后端现存的 password-login 是管理员专用（收 username、非管理员 403），与 C 端
 * passwordLogin 不是同一能力，本前端不接它。
 */
export type AuthGateway = {
  sendEmailCode: (input: SendEmailCodeInput) => Promise<void>;
  emailCodeLogin: (input: EmailCodeLoginInput) => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  passwordLogin: (input: PasswordLoginInput) => Promise<AuthSession>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  googleLogin: (input: GoogleLoginInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  /** 回源获取当前用户。可选能力：mock 数据源不提供，调用方按缺省降级。 */
  getMe?: () => Promise<AuthUser>;
};

/**
 * UI 可稳定映射文案的错误码。
 * CONTRACT_UNAVAILABLE 表示该能力的后端契约尚未确认，api 数据源据此显式失败，
 * 不回退 mock 冒充真实数据（见 docs/api/company-research.md 第五节）。
 */
export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_CODE'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'CONTRACT_UNAVAILABLE'
  | 'generic';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  /** 服务端返回的人类可读消息（generic 时用于兜底展示）。 */
  readonly serverMessage?: string;
  readonly status?: number;
  readonly apiCode?: string | number;
  readonly errorCode?: string;

  constructor(
    code: AuthErrorCode,
    serverMessage?: string,
    options?: { status?: number; apiCode?: string | number; errorCode?: string },
  ) {
    super(serverMessage || code);
    this.name = 'AuthError';
    this.code = code;
    this.serverMessage = serverMessage;
    this.status = options?.status;
    this.apiCode = options?.apiCode;
    this.errorCode = options?.errorCode;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
