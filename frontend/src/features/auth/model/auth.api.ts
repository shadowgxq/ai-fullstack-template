import { isApiError, request } from '../../../shared/api';
import { AuthError, isAuthError, type AuthErrorCode, type AuthGateway } from './auth.gateway';
import type { AuthSession, AuthUser, PasswordLoginInput } from './auth.types';

const AUTH_PATH = '/v1/auth';
type Envelope<T> = { code: number; message: string; data: T };
type UserDto = { id: number; username: string };
type TokenDto = { access_token: string; token_type: string };

function errorCode(code: string | number | undefined, status?: number): AuthErrorCode {
  if (code === 40001) return 'USERNAME_TAKEN';
  if (code === 40101 || status === 401) return 'INVALID_CREDENTIALS';
  if (code === 42901 || status === 429) return 'RATE_LIMITED';
  return 'generic';
}

async function call<T>(
  method: 'GET' | 'POST',
  url: string,
  data?: unknown,
  token?: string,
): Promise<T> {
  try {
    const result = await request<Envelope<T>>({
      method,
      url,
      data,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
    if (result?.code !== 0) {
      throw new AuthError(errorCode(result?.code), result?.message, result?.code);
    }
    return result.data;
  } catch (error) {
    if (isAuthError(error)) throw error;
    if (isApiError(error)) {
      throw new AuthError(
        errorCode(error.code, error.status),
        error.messageFromServer ? error.message : undefined,
        error.code,
      );
    }
    throw new AuthError('generic');
  }
}

function mapUser(dto: UserDto): AuthUser {
  if (!dto || !Number.isInteger(dto.id) || typeof dto.username !== 'string') {
    throw new AuthError('generic');
  }
  // Roles are not returned by this backend; never infer admin from a username.
  return {
    userId: String(dto.id),
    username: dto.username,
    nickname: dto.username,
    email: null,
    avatar: null,
    role: 'user',
    admin: false,
  };
}

async function passwordLogin(input: PasswordLoginInput): Promise<AuthSession> {
  const dto = await call<TokenDto>('POST', `${AUTH_PATH}/login`, input);
  if (!dto?.access_token || dto.token_type !== 'bearer') throw new AuthError('generic');
  const user = mapUser(await call<UserDto>('GET', `${AUTH_PATH}/me`, undefined, dto.access_token));
  // No lifetime is advertised by TokenResponse; do not invent one or decode claims as authority.
  return { token: dto.access_token, newUser: false, user };
}

async function unsupported(): Promise<never> {
  throw new AuthError('generic', 'This capability is not provided by the backend.');
}

export const apiAuthGateway: AuthGateway = {
  passwordLogin,
  async register({ username, password }) {
    await call<UserDto>('POST', `${AUTH_PATH}/register`, { username, password });
    return { ...(await passwordLogin({ username, password })), newUser: true };
  },
  async getMe() {
    return mapUser(await call<UserDto>('GET', `${AUTH_PATH}/me`));
  },
  async logout() {
    await call<null>('POST', `${AUTH_PATH}/logout`);
  },
  sendEmailCode: unsupported,
  emailCodeLogin: unsupported,
  resetPassword: unsupported,
  googleLogin: unsupported,
};
