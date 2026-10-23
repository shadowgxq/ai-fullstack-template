import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import {
  clearAuthToken,
  getAuthSession,
  getAuthToken,
  getSessionGeneration,
  hydrateAuthToken,
  saveAuthSession,
} from '../src/shared/api/auth-token';
import { api, parseProfile, parseWechatLogin } from '../src/shared/api/gateway';
import { loginWithWeChat, logoutCurrentSession } from '../src/features/auth/session';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';

type RequestCallbacks = {
  success(response: { statusCode: number; data: unknown }): void;
  fail(): void;
  header: Record<string, string>;
  data?: unknown;
  url: string;
};
let calls: RequestCallbacks[];
const storage = new Map<string, unknown>();
beforeEach(() => {
  vi.resetAllMocks();
  storage.clear();
  Taro.getStorageSync.mockImplementation((key: string) => storage.get(key));
  Taro.setStorageSync.mockImplementation((key: string, value: unknown) => storage.set(key, value));
  Taro.removeStorageSync.mockImplementation((key: string) => storage.delete(key));
  clearAuthToken();
  calls = [];
  Taro.request.mockImplementation((options: RequestCallbacks) => {
    calls.push(options);
    return Object.assign(new Promise(() => {}), { abort: vi.fn() });
  });
});

function success(index: number, data: unknown) {
  calls[index].success({ statusCode: 200, data: { code: 0, message: 'success', data } });
}

function loginResult(userId: number) {
  return {
    access_token: 'token-' + userId,
    token_type: 'bearer',
    user: { id: userId, username: 'wx-user' },
  };
}

describe('provided account DTOs', () => {
  it('validates identity and nullable profile fields without inventing user details', () => {
    expect(parseWechatLogin(loginResult(2)).user.id).toBe(2);
    expect(
      parseProfile({
        user_id: 2,
        version: 1,
        nickname: null,
        avatar_media_id: null,
        city_id: null,
      }),
    ).toEqual({
      user_id: 2,
      version: 1,
      nickname: null,
      avatar_media_id: null,
      city_id: null,
    });
    expect(() => parseProfile({ user_id: 2 })).toThrow('格式');
    expect(() =>
      parseProfile({
        user_id: 2,
        version: 1,
        nickname: null,
        avatar_media_id: 'not-a-uuid',
        city_id: null,
      }),
    ).toThrow();
    expect(() => parseWechatLogin(loginResult(0))).toThrow();
  });
  it('exchanges a newly obtained code anonymously then persists the identified session', async () => {
    Taro.login.mockResolvedValueOnce({ code: 'new-code' });
    const attempt = loginWithWeChat();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toContain('/api/v1/auth/wechat');
    expect(calls[0].data).toEqual({ code: 'new-code' });
    expect(calls[0].header.Authorization).toBeUndefined();
    success(0, loginResult(2));
    await expect(attempt).resolves.toMatchObject({ userId: 2, token: 'token-2' });
    const profile = api.profile();
    success(1, { user_id: 2, version: 1, nickname: null, avatar_media_id: null, city_id: null });
    await expect(profile).resolves.toMatchObject({ user_id: 2, version: 1, nickname: null });
  });
});

describe('session lifecycle and races', () => {
  it('rejects late success as well as late 401 from a previous session', async () => {
    saveAuthSession('old', 1);
    const first = api.me();
    const second = api.me();
    saveAuthSession('new', 2);
    success(0, { id: 1, username: 'old' });
    calls[1].success({ statusCode: 401, data: null });
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(getAuthToken()).toBe('new');
  });
  it('changes scope even when the same account signs in again and clears private caches', () => {
    saveAuthSession('first', 1);
    const first = getAuthSession();
    queryClient.setQueryData(sessionQueryKey(first, 'draft'), { private: true });
    saveAuthSession('next', 1);
    expect(getAuthSession()?.generation).not.toBe(first?.generation);
    expect(queryClient.getQueryData(sessionQueryKey(first, 'draft'))).toBeUndefined();
    expect(sessionQueryKey(getAuthSession(), 'draft')).not.toEqual(sessionQueryKey(first, 'draft'));
  });
  it('keeps a newer login when an older logout completes later', async () => {
    saveAuthSession('old', 1);
    const logout = logoutCurrentSession();
    saveAuthSession('new', 2);
    queryClient.setQueryData(sessionQueryKey(getAuthSession(), 'profile'), { user_id: 2 });
    success(0, null);
    await expect(logout).resolves.toBeNull();
    expect(getAuthToken()).toBe('new');
    expect(queryClient.getQueryData(sessionQueryKey(getAuthSession(), 'profile'))).toEqual({
      user_id: 2,
    });
  });
  it('clears local data with an accurate warning after failed remote revocation', async () => {
    saveAuthSession('old', 1);
    const logout = logoutCurrentSession();
    calls[0].success({ statusCode: 503, data: { code: 50301, data: null } });
    await expect(logout).resolves.toContain('尚未确认服务端撤销');
    expect(getAuthSession()).toBeNull();
    expect(storage.get('fullstack.miniprogram.signed-out.v1')).toBe(true);
  });
  it('does not restore a removed-token failure during app foreground hydration', () => {
    saveAuthSession('old', 1);
    Taro.removeStorageSync.mockImplementation(() => {
      throw new Error('disk');
    });
    expect(() => clearAuthToken()).toThrow('未能完整清理');
    hydrateAuthToken();
    expect(getAuthSession()).toBeNull();
    expect(storage.get('fullstack.miniprogram.signed-out.v1')).toBe(true);
  });
  it('reports lack of durable protection if both marker and removal fail', () => {
    saveAuthSession('old', 1);
    Taro.setStorageSync.mockImplementation(() => {
      throw new Error('disk');
    });
    Taro.removeStorageSync.mockImplementation(() => {
      throw new Error('disk');
    });
    expect(() => clearAuthToken()).toThrow('无法持久清理');
    hydrateAuthToken();
    expect(getAuthSession()).toBeNull();
  });
  it('never publishes login when session persistence partially fails', () => {
    Taro.setStorageSync.mockImplementation((key: string, value: unknown) => {
      if (key.endsWith('session.v2')) throw new Error('quota');
      storage.set(key, value);
    });
    expect(() => saveAuthSession('new', 2)).toThrow('无法保存');
    expect(getAuthSession()).toBeNull();
    expect(storage.get('fullstack.miniprogram.signed-out.v1')).toBe(true);
  });
  it('prevents a late login exchange from restoring a signed-out session', async () => {
    Taro.login.mockResolvedValueOnce({ code: 'one-time' });
    const login = loginWithWeChat();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    clearAuthToken();
    success(0, loginResult(1));
    await expect(login).rejects.toMatchObject({ name: 'AbortError' });
    expect(getAuthSession()).toBeNull();
  });
  it('prevents a login attempt after its page has left', async () => {
    Taro.login.mockResolvedValueOnce({ code: 'one-time' });
    const controller = new AbortController();
    const login = loginWithWeChat(controller.signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    success(0, loginResult(1));
    await expect(login).rejects.toMatchObject({ name: 'AbortError' });
    expect(getAuthSession()).toBeNull();
  });
  it('retries platform cancellation with a fresh code', async () => {
    Taro.login.mockRejectedValueOnce({ errMsg: 'login:fail cancel' });
    await expect(loginWithWeChat()).rejects.toThrow('微信登录未完成');
    expect(calls).toHaveLength(0);
    Taro.login.mockResolvedValueOnce({ code: 'fresh' });
    const login = loginWithWeChat();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].data).toEqual({ code: 'fresh' });
    success(0, loginResult(1));
    await login;
  });
  it('does not accept credentials prepared for an invalidated generation', () => {
    const expected = getSessionGeneration();
    clearAuthToken();
    expect(() => saveAuthSession('stale', 1, expected)).toThrow('请求已取消');
    expect(getAuthSession()).toBeNull();
  });
});
