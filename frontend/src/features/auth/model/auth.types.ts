/** Template UI model; backend DTO mapping lives in auth.api.ts. */
export type EmailCodeScene = 'login_register' | 'reset_password';

export type AuthUser = {
  userId: string;
  username: string;
  nickname: string;
  email: string | null;
  avatar: string | null;
  role: string;
  admin: boolean;
};

export type AuthSession = {
  token: string;
  expiresIn?: number;
  newUser: boolean;
  user: AuthUser;
};

export type SendEmailCodeInput = {
  email: string;
  scene: EmailCodeScene;
};

export type SendEmailCodeResult = {
  cooldownSeconds: number;
  expireSeconds: number;
};

export type EmailCodeLoginInput = { email: string; code: string };
export type PasswordLoginInput = { username: string; password: string };
export type RegisterInput = { username: string; email: string; password: string; code: string };
export type ResetPasswordInput = { email: string; code: string; newPassword: string };
/** Google GIS 支持授权码与 ID token；真实登录使用授权码，mock 仍使用 credential。 */
export type GoogleLoginInput = { credential: string } | { code: string };
