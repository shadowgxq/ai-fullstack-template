// 与需求文档 22.1「用户」对齐；后端契约确认前只保留 UI 实际消费的字段。
export type AuthUser = {
  userId: string;
  email: string;
};

export type AuthSession = {
  token: string;
  expiresIn: number;
  newUser: boolean;
  user: AuthUser;
};

/**
 * Google 登录凭据，两条链路各产出一种，后端 `/account/google-login` 按形态分支：
 * - `credential`：GIS ID token 流，按钮由 Google 在跨域 iframe 内渲染；
 * - `code`：OAuth 授权码流，按钮我方自绘，后端拿 code 向 Google 换 token。
 */
export type GoogleLoginInput = { credential: string } | { code: string };

/**
 * 验证码场景，对齐后端 email-code/send 的 scene 取值。
 * RESET_PASSWORD 对应后端 VerificationScene.RESET_PASSWORD（枚举早已存在，发送侧
 * 复用现有接口即可）；其余值后端会归一化到 LOGIN_REGISTER。
 */
export type EmailCodeScene = 'LOGIN' | 'REGISTER' | 'BIND' | 'RESET_PASSWORD';

export type SendEmailCodeInput = {
  email: string;
  scene: EmailCodeScene;
};

export type EmailCodeLoginInput = {
  email: string;
  code: string;
};

/**
 * C 端邮箱密码登录（需求底稿 18.5，2026-08-05 恢复）。
 * 注意与后端现存的管理员 password-login 不是一回事：那个收 username 且非管理员 403。
 * C 端接口契约见 docs/api/account-password-backend-gaps.md，落地前 api 数据源显式失败。
 */
export type PasswordLoginInput = {
  email: string;
  password: string;
};

/**
 * 邮箱密码注册（需求底稿 18.4；2026-08-05 产品拍板补充邮箱验证码，封占号）。
 * code 由 email-code/send（scene=REGISTER）发出。用户协议勾选是 UI 层校验，不进请求体。
 */
export type RegisterInput = {
  email: string;
  code: string;
  password: string;
};

/**
 * 找回密码：验证码三段式的最后一步（发送侧复用 email-code/send + RESET_PASSWORD 场景）。
 * 存量用户的密码在建号时被设为随机 UUID，这条链路是他们启用密码登录的唯一途径。
 */
export type ResetPasswordInput = {
  email: string;
  code: string;
  newPassword: string;
};

