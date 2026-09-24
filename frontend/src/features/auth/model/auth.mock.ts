import { AuthError, type AuthGateway } from './auth.gateway';
import type { AuthSession, AuthUser } from './auth.types';

const MOCK_LATENCY_MS = 240;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;

function delay(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));
}

function userFromIdentity(identity: string, admin = false): AuthUser {
  const username = identity.split('@')[0] || 'user';
  return {
    userId: `mock-${username}`,
    username,
    nickname: admin ? 'Admin' : username,
    email: identity.includes('@') ? identity : `${identity}@example.com`,
    avatar: null,
    role: admin ? 'admin' : 'user',
    admin,
  };
}

function session(user: AuthUser, newUser = false): AuthSession {
  return { token: `mock-token-${user.userId}`, expiresIn: 604800, newUser, user };
}

function assertEmail(email: string): void {
  if (!EMAIL_PATTERN.test(email.trim())) throw new AuthError('INVALID_EMAIL');
}

export const mockAuthGateway: AuthGateway = {
  async sendEmailCode({ email, scene }) {
    await delay();
    assertEmail(email);
    if (scene === 'reset_password' && email.trim().toLowerCase() === 'unknown@example.com') {
      throw new AuthError('EMAIL_NOT_REGISTERED');
    }
    return { cooldownSeconds: 60, expireSeconds: 600 };
  },
  async emailCodeLogin({ email, code }) {
    await delay();
    assertEmail(email);
    if (!CODE_PATTERN.test(code.trim())) throw new AuthError('INVALID_CODE');
    const normalized = email.trim().toLowerCase();
    return session(userFromIdentity(normalized), normalized === 'fresh@example.com');
  },
  async passwordLogin({ username, password }) {
    await delay();
    const normalized = username.trim();
    if (normalized === 'admin' && password === 'admin123') {
      return session(userFromIdentity('admin', true));
    }
    if (normalized && password === 'Passw0rd123') {
      return session(userFromIdentity(normalized));
    }
    throw new AuthError('INVALID_CREDENTIALS');
  },
  async register({ username, email, password, code }) {
    await delay();
    assertEmail(email);
    if (!CODE_PATTERN.test(code.trim())) throw new AuthError('INVALID_CODE');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new AuthError('PASSWORD_WEAK');
    }
    if (email.trim().toLowerCase() === 'taken@example.com') throw new AuthError('EMAIL_TAKEN');
    if (username.trim() === 'admin') throw new AuthError('USERNAME_TAKEN');
    return session({ ...userFromIdentity(email.trim().toLowerCase()), username: username.trim() });
  },
  async resetPassword({ email, code, newPassword }) {
    await delay();
    assertEmail(email);
    if (email.trim().toLowerCase() === 'unknown@example.com') {
      throw new AuthError('EMAIL_NOT_REGISTERED');
    }
    if (!CODE_PATTERN.test(code.trim())) throw new AuthError('INVALID_CODE');
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new AuthError('PASSWORD_WEAK');
    }
  },
  async googleLogin(input) {
    await delay();
    const proof = 'credential' in input ? input.credential : input.code;
    if (!proof.trim()) throw new AuthError('GOOGLE_CREDENTIAL_INVALID');
    return session(userFromIdentity('google@example.com'));
  },
  async logout() {
    await delay();
  },
};
