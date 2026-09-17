import { AuthError, type AuthGateway } from './auth.gateway';
import type {
  AuthSession,
  EmailCodeLoginInput,
  GoogleLoginInput,
  PasswordLoginInput,
  RegisterInput,
  ResetPasswordInput,
  SendEmailCodeInput,
} from './auth.types';

const MOCK_LATENCY_MS = 360;
const MOCK_GOOGLE_EMAIL = 'google-user@example.com';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildSession(email: string, newUser: boolean): AuthSession {
  return {
    token: `mock-jwt-${crypto.randomUUID()}`,
    expiresIn: 86400,
    newUser,
    user: { userId: `mock-user-${email}`, email },
  };
}

/**
 * 创建一个状态独立的 mock 认证网关。
 *
 * 账户表是闭包私有状态，测试可以为每个用例创建全新实例，避免用例间相互污染；
 * 与 entities/research 的 createMockResearchRepository 保持同一模式。
 *
 * 预置账户只存在于 mock 实现内部，不得出现在任何用户可见文案里
 * （见 docs/frontend/guides/theming-and-i18n.md「文案边界」）。
 */
export function createMockAuthGateway(): AuthGateway {
  // 已注册邮箱集合；验证码登录注册二合一，不要求有密码。
  const emailCodeAccounts = new Set<string>(['demo@example.com']);
  const googleAccounts = new Set<string>();
  // 邮箱 → 密码。只有走过密码注册或找回密码的账户才在这里——
  // 对应真实后端「存量用户密码是随机 UUID、不可用」的状态。
  const passwordAccounts = new Map<string, string>();

  return {
    async sendEmailCode(input: SendEmailCodeInput): Promise<void> {
      await delay(MOCK_LATENCY_MS);
      if (!input.email.includes('@')) {
        throw new AuthError('INVALID_EMAIL');
      }
    },

    async emailCodeLogin(input: EmailCodeLoginInput): Promise<AuthSession> {
      await delay(MOCK_LATENCY_MS);
      if (!/^\d{6}$/.test(input.code)) {
        throw new AuthError('INVALID_CODE');
      }
      const isNewUser = !emailCodeAccounts.has(input.email);
      emailCodeAccounts.add(input.email);
      return buildSession(input.email, isNewUser);
    },

    async register(input: RegisterInput): Promise<AuthSession> {
      await delay(MOCK_LATENCY_MS);
      if (!input.email.includes('@')) {
        throw new AuthError('INVALID_EMAIL');
      }
      // 与后端一致：先验码再查重——「已注册」信号只有邮箱主人（持有效码）拿得到
      if (!/^\d{6}$/.test(input.code)) {
        throw new AuthError('INVALID_CODE');
      }
      if (emailCodeAccounts.has(input.email) || passwordAccounts.has(input.email)) {
        throw new AuthError('EMAIL_ALREADY_REGISTERED');
      }
      emailCodeAccounts.add(input.email);
      passwordAccounts.set(input.email, input.password);
      // 需求底稿 18.4：注册成功即自动登录。
      return buildSession(input.email, true);
    },

    async passwordLogin(input: PasswordLoginInput): Promise<AuthSession> {
      await delay(MOCK_LATENCY_MS);
      // 只认走过密码注册/找回密码的账户；验证码建的号没有可用密码，
      // 与真实后端「密码是随机 UUID」的行为一致。
      if (passwordAccounts.get(input.email) !== input.password) {
        throw new AuthError('INVALID_CREDENTIALS');
      }
      return buildSession(input.email, false);
    },

    async resetPassword(input: ResetPasswordInput): Promise<void> {
      await delay(MOCK_LATENCY_MS);
      if (!/^\d{6}$/.test(input.code)) {
        throw new AuthError('INVALID_CODE');
      }
      // 找回密码是存量验证码账户启用密码登录的唯一途径，重置即登记。
      emailCodeAccounts.add(input.email);
      passwordAccounts.set(input.email, input.newPassword);
    },

    async googleLogin(input: GoogleLoginInput): Promise<AuthSession> {
      await delay(MOCK_LATENCY_MS);
      // 两条链路（credential / code）都只要求「拿到了非空凭据」，mock 不区分。
      const evidence = 'credential' in input ? input.credential : input.code;
      if (!evidence) {
        throw new AuthError('generic');
      }
      // mock 无法校验真实 credential，用固定演示账户表达「同一 Google 账号重复登录」。
      const isNewUser = !googleAccounts.has(MOCK_GOOGLE_EMAIL);
      googleAccounts.add(MOCK_GOOGLE_EMAIL);
      return buildSession(MOCK_GOOGLE_EMAIL, isNewUser);
    },

    async logout(): Promise<void> {
      await delay(120);
    },
  };
}

/** 应用运行时使用的实例；auth.source.ts 按 VITE_DATA_SOURCE 单点切换数据源。 */
export const mockAuthGateway: AuthGateway = createMockAuthGateway();
