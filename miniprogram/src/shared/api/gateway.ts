import type { components } from './schema.generated';
import { ApiError, isRecord } from './errors';
import { parseEnvelope, requestJson } from './request';

export type CurrentUser = components['schemas']['CurrentUserResponse'];
export type LoginToken = components['schemas']['TokenResponse'];
export type WechatLogin = components['schemas']['WechatTokenResponse'];
export type Profile = components['schemas']['ProfileResponse'];
export type ProfilePatch = components['schemas']['ProfilePatch'];

export function parseUser(value: unknown): CurrentUser {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    typeof value.username !== 'string'
  ) {
    throw new ApiError('用户信息格式不正确', 'invalid-response');
  }
  return { id: value.id, username: value.username };
}

export function parseWechatLogin(value: unknown): WechatLogin {
  const token = parseToken(value);
  if (!isRecord(value)) throw new ApiError('登录响应格式不正确', 'invalid-response');
  return { ...token, user: parseUser(value.user) };
}

export function parseProfile(value: unknown): Profile {
  if (
    !isRecord(value) ||
    typeof value.user_id !== 'number' ||
    !Number.isSafeInteger(value.user_id) ||
    value.user_id <= 0 ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version <= 0 ||
    !(value.nickname === null || typeof value.nickname === 'string') ||
    !(value.city_id === null || typeof value.city_id === 'string') ||
    !(
      value.avatar_media_id === null ||
      (typeof value.avatar_media_id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value.avatar_media_id,
        ))
    )
  )
    throw new ApiError('个人资料格式不正确', 'invalid-response');
  return {
    user_id: value.user_id,
    version: value.version,
    nickname: value.nickname,
    avatar_media_id: value.avatar_media_id,
    city_id: value.city_id,
  };
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
  wechatLogin: (code: string, signal?: AbortSignal) =>
    requestJson('/api/v1/auth/wechat', (body) => parseEnvelope(body, parseWechatLogin), {
      method: 'POST',
      data: { code } satisfies components['schemas']['WechatLoginRequest'],
      auth: false,
      signal,
    }),
  profile: (signal?: AbortSignal) =>
    requestJson('/api/v1/profile', (body) => parseEnvelope(body, parseProfile), { signal }),
  patchProfile: (data: ProfilePatch, signal?: AbortSignal) =>
    requestJson('/api/v1/profile', (body) => parseEnvelope(body, parseProfile), {
      method: 'PATCH',
      data,
      signal,
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
