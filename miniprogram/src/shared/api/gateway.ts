import type { components } from './schema.generated';
import { ApiError, isRecord } from './errors';
import { parseEnvelope, requestJson } from './request';

export type Credentials = components['schemas']['LoginRequest'];
export type CurrentUser = components['schemas']['CurrentUserResponse'];
export type LoginToken = components['schemas']['TokenResponse'];

export function parseUser(value: unknown): CurrentUser {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !Number.isInteger(value.id) ||
    typeof value.username !== 'string'
  ) {
    throw new ApiError('用户信息格式不正确', 'invalid-response');
  }
  return { id: value.id, username: value.username };
}
export function parseToken(value: unknown): LoginToken {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    !value.access_token.trim() ||
    value.token_type !== 'bearer'
  ) {
    throw new ApiError('登录凭据格式不正确', 'invalid-response');
  }
  return { access_token: value.access_token, token_type: value.token_type };
}

export const api = {
  login: (credentials: Credentials) =>
    requestJson('/api/v1/auth/login', (body) => parseEnvelope(body, parseToken), {
      method: 'POST',
      data: credentials,
      auth: false,
    }),
  me: (signal?: AbortSignal) =>
    requestJson('/api/v1/auth/me', (body) => parseEnvelope(body, parseUser), { signal }),
  logout: () =>
    requestJson(
      '/api/v1/auth/logout',
      (body) =>
        parseEnvelope(body, (data) => {
          if (data !== null) throw new ApiError('登出响应格式不正确', 'invalid-response');
          return undefined;
        }),
      { method: 'POST' },
    ),
  health: (signal?: AbortSignal) =>
    requestJson(
      '/health',
      (body) => {
        if (!isRecord(body) || body.status !== 'ok')
          throw new ApiError('健康检查响应格式不正确', 'invalid-response');
        return { status: 'ok' as const };
      },
      { auth: false, signal },
    ),
};
