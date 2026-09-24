import type {
  AuthSession,
  AuthUser,
  EmailCodeLoginInput,
  GoogleLoginInput,
  PasswordLoginInput,
  RegisterInput,
  ResetPasswordInput,
  SendEmailCodeInput,
  SendEmailCodeResult,
} from './auth.types';

export type AuthGateway = {
  sendEmailCode: (input: SendEmailCodeInput) => Promise<SendEmailCodeResult>;
  emailCodeLogin: (input: EmailCodeLoginInput) => Promise<AuthSession>;
  passwordLogin: (input: PasswordLoginInput) => Promise<AuthSession>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  googleLogin: (input: GoogleLoginInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  getMe?: () => Promise<AuthUser>;
};

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_CODE'
  | 'RATE_LIMITED'
  | 'INVALID_CREDENTIALS'
  | 'USER_DISABLED'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'USERNAME_INVALID'
  | 'PASSWORD_WEAK'
  | 'PASSWORD_MISMATCH'
  | 'EMAIL_NOT_REGISTERED'
  | 'GOOGLE_DISABLED'
  | 'GOOGLE_CREDENTIAL_INVALID'
  | 'generic';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  /** 原始服务端 message 仅供诊断；用户可见文案必须由 error code 和 locale 生成。 */
  readonly serverMessage?: string;
  readonly serverCode?: string | number;

  constructor(code: AuthErrorCode, serverMessage?: string, serverCode?: string | number) {
    super(serverMessage || code);
    this.name = 'AuthError';
    this.code = code;
    this.serverMessage = serverMessage;
    this.serverCode = serverCode;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
