import { describe, expect, it } from 'vitest';

import type { ApiError } from '../../../shared/api';
import { AuthError } from './auth.gateway';
import {
  mapAccountUser,
  mapLoginResponse,
  toAuthError,
  unwrapResult,
  type AccountUserDto,
  type LoginResponseDto,
  type ResultDto,
} from './auth.api';

/**
 * 按 shared/api/api-error.ts 里 isApiError 的真实判据构造：
 * `isRecord(error) && error.__apiError === true && typeof error.message === 'string'`。
 */
function buildApiError(status: number, message = 'server message'): ApiError {
  return { __apiError: true, message, status };
}

describe('mapAccountUser', () => {
  it('只取 userId 与 email，忽略后端多余字段', () => {
    const dto: AccountUserDto = {
      userId: 'u-1',
      username: 'someone',
      nickname: '昵称',
      email: 'user@example.com',
      avatar: 'https://example.com/a.png',
      role: 'USER',
      admin: false,
    };

    expect(mapAccountUser(dto)).toEqual({ userId: 'u-1', email: 'user@example.com' });
  });
});

describe('mapLoginResponse', () => {
  it('保留 newUser 标识，且 user 已收窄为 AuthUser', () => {
    const dto: LoginResponseDto = {
      token: 'jwt-token',
      expiresIn: 604800,
      newUser: true,
      user: {
        userId: 'u-2',
        username: null,
        nickname: null,
        email: 'new@example.com',
        avatar: null,
        role: 'USER',
        admin: false,
      },
    };

    expect(mapLoginResponse(dto)).toEqual({
      token: 'jwt-token',
      expiresIn: 604800,
      newUser: true,
      user: { userId: 'u-2', email: 'new@example.com' },
    });
  });
});

describe('unwrapResult', () => {
  it('code 为 200 时返回 data', () => {
    const envelope: ResultDto<{ value: number }> = {
      code: 200,
      message: 'success',
      data: { value: 1 },
    };

    expect(unwrapResult(envelope, 'generic')).toEqual({ value: 1 });
  });

  it('code 非 200 时抛出 AuthError，错误码是传入的 failCode，且 serverMessage 是响应的 message', () => {
    const envelope: ResultDto<null> = {
      code: 40010,
      message: '邮箱格式不正确',
      data: null,
    };

    let caught: unknown;
    try {
      unwrapResult(envelope, 'INVALID_EMAIL');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).code).toBe('INVALID_EMAIL');
    expect((caught as AuthError).serverMessage).toBe('邮箱格式不正确');
  });
});

describe('toAuthError', () => {
  it('400 落到传入的业务码', () => {
    const error = toAuthError(buildApiError(400, '验证码错误'), 'INVALID_CODE');

    expect(error.code).toBe('INVALID_CODE');
    expect(error.serverMessage).toBe('验证码错误');
  });

  it('401 也落到业务码', () => {
    const error = toAuthError(buildApiError(401, '验证码错误'), 'INVALID_CODE');

    expect(error.code).toBe('INVALID_CODE');
    expect(error.serverMessage).toBe('验证码错误');
  });

  it('500 归为 generic 且保留服务端消息', () => {
    const error = toAuthError(buildApiError(500, '服务器开小差了'), 'INVALID_CODE');

    expect(error.code).toBe('generic');
    expect(error.serverMessage).toBe('服务器开小差了');
  });

  it('非 API 错误（普通 Error）归为 generic', () => {
    const error = toAuthError(new Error('network down'), 'INVALID_CODE');

    expect(error.code).toBe('generic');
  });

  it('传入的已经是 AuthError 时原样返回', () => {
    const original = new AuthError('INVALID_CODE', '原始消息');

    expect(toAuthError(original, 'generic')).toBe(original);
  });
});
