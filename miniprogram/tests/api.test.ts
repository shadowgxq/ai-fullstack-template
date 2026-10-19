import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { requestJson, parseEnvelope, resolveApiUrl } from '../src/shared/api/request';
import {
  saveAuthToken,
  getAuthToken,
  clearAuthToken,
  notifyUnauthorized,
  setUnauthorizedHandler,
  subscribeAuthToken,
} from '../src/shared/api/auth-token';
import { parseUser, parseToken, api } from '../src/shared/api/gateway';
import { normalizeApiBaseUrl } from '../config/env';
import { validateCredentials } from '../src/features/auth/validation';

type Callbacks = {
  success: (response: { statusCode: number; data: unknown }) => void;
  fail: () => void;
  header: Record<string, string>;
  url: string;
};
let callbacks: Callbacks;
let abort: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  setUnauthorizedHandler(null);
  abort = vi.fn();
  Taro.request.mockImplementation((options: Callbacks) => {
    callbacks = options;
    return Object.assign(new Promise(() => {}), { abort });
  });
});

describe('configuration and contracts', () => {
  it('permits unconfigured preview without inventing a service', () => {
    expect(normalizeApiBaseUrl(undefined, true)).toBe('');
    expect(() => resolveApiUrl('', '/health')).toThrow('尚未配置');
  });
  it('rejects credentials, non-origin and non-HTTPS production config', () => {
    for (const url of [
      'https://user:pw@example.test',
      'https://example.test/api',
      'https://example.test?key=x',
      'http://example.test',
    ]) {
      expect(() => normalizeApiBaseUrl(url, true)).toThrow();
    }
    expect(normalizeApiBaseUrl(' http://localhost:8000/ ', false)).toBe('http://localhost:8000');
  });
  it('never accepts cross-origin request paths', () => {
    for (const path of ['//evil.test', 'https://evil.test', '/\\evil.test', '/a#b'])
      expect(() => resolveApiUrl('https://api.test', path)).toThrow();
  });
  it('distinguishes business failure, malformed responses and nullable success', () => {
    expect(() => parseEnvelope({ code: 4, message: 'bad', data: null }, (x) => x)).toThrow(
      '操作未成功',
    );
    expect(() => parseEnvelope({ code: 0, message: 'ok' }, (x) => x)).toThrow('格式');
    expect(parseEnvelope({ code: 0, message: 'ok', data: null }, (x) => x)).toBeNull();
  });
  it('validates untrusted user and token payloads', () => {
    expect(parseUser({ id: 1, username: 'user' })).toEqual({ id: 1, username: 'user' });
    expect(() => parseUser({ id: '1', username: 'user' })).toThrow();
    expect(() => parseToken({ access_token: '', token_type: 'bearer' })).toThrow();
    expect(() => parseToken({ access_token: 'a', token_type: 'cookie' })).toThrow();
  });
  it('checks byte limits without changing usernames', () => {
    expect(validateCredentials(' user ', '中'.repeat(24))).toEqual({});
    expect(validateCredentials('user', '中'.repeat(25)).password).toBeDefined();
    expect(validateCredentials('user', '😀'.repeat(18))).toEqual({});
    expect(validateCredentials('user', '😀'.repeat(19)).password).toBeDefined();
    expect(validateCredentials('', '').username).toBeDefined();
    expect(validateCredentials('user', '\ud800').password).toBeDefined();
  });
});

describe('request and session isolation', () => {
  it('uses the real backend health route without authorization', async () => {
    saveAuthToken('secret');
    const promise = api.health();
    expect(callbacks.url).toBe('https://api.example.test/health');
    expect(callbacks.header.Authorization).toBeUndefined();
    callbacks.success({ statusCode: 200, data: { status: 'ok' } });
    await expect(promise).resolves.toEqual({ status: 'ok' });
  });
  it('attaches Bearer to protected requests and parses envelopes', async () => {
    saveAuthToken('secret');
    const promise = api.me();
    expect(callbacks.header.Authorization).toBe('Bearer secret');
    callbacks.success({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: { id: 2, username: 'u' } },
    });
    await expect(promise).resolves.toEqual({ id: 2, username: 'u' });
  });
  it('clears only the matching session on 401', async () => {
    saveAuthToken('old');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const promise = api.me();
    callbacks.success({ statusCode: 401, data: null });
    await expect(promise).rejects.toMatchObject({ kind: 'http', status: 401 });
    expect(getAuthToken()).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
  });
  it('does not clear a new login after a late old-token 401', async () => {
    saveAuthToken('old');
    const promise = api.me();
    saveAuthToken('new');
    callbacks.success({ statusCode: 401, data: null });
    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(getAuthToken()).toBe('new');
  });
  it('does not mark failed persistence as login success', () => {
    Taro.setStorageSync.mockImplementationOnce(() => {
      throw new Error('quota');
    });
    expect(() => saveAuthToken('token')).toThrow();
    expect(getAuthToken()).toBeNull();
  });
  it('keeps HTTP failure observable when local cleanup fails', async () => {
    saveAuthToken('old');
    Taro.removeStorageSync.mockImplementationOnce(() => {
      throw new Error('disk');
    });
    const promise = api.me();
    callbacks.success({ statusCode: 401, data: null });
    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(getAuthToken()).toBeNull();
  });
  it('preserves 422 safe details and does not clear authorization on 503', async () => {
    saveAuthToken('secret');
    const promise = api.me();
    callbacks.success({ statusCode: 503, data: { code: 50301, data: null } });
    await expect(promise).rejects.toMatchObject({ status: 503, code: 50301 });
    expect(getAuthToken()).toBe('secret');
    const invalid = api.me();
    const details = [{ loc: ['body', 'username'], msg: 'bad' }];
    callbacks.success({ statusCode: 422, data: { code: 422, data: details } });
    await expect(invalid).rejects.toMatchObject({ details });
  });
  it('maps transport failure without synthesizing empty data', async () => {
    const promise = api.health();
    callbacks.fail();
    await expect(promise).rejects.toMatchObject({ kind: 'network' });
  });
  it('cancels the request task and ignores late callbacks', async () => {
    const controller = new AbortController();
    const promise = api.me(controller.signal);
    controller.abort();
    callbacks.success({ statusCode: 200, data: {} });
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(abort).toHaveBeenCalledOnce();
  });
  it('does not start an already aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestJson('/health', (x) => x, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(Taro.request).not.toHaveBeenCalled();
  });
  it('consumes the Taro internal rejected promise as well as its callback', async () => {
    Taro.request.mockImplementationOnce((options: Callbacks) => {
      queueMicrotask(() => options.fail());
      return Object.assign(Promise.reject(new Error('transport')), { abort });
    });
    await expect(api.health()).rejects.toMatchObject({ kind: 'network' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  it('ignores anonymous unauthorized responses', () => {
    saveAuthToken('current');
    notifyUnauthorized(null);
    expect(getAuthToken()).toBe('current');
  });
});

it('notifies page subscribers when a session is saved or cleared', () => {
  const listener = vi.fn();
  const unsubscribe = subscribeAuthToken(listener);
  saveAuthToken('first');
  clearAuthToken();
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  saveAuthToken('second');
  expect(listener).toHaveBeenCalledTimes(2);
});
