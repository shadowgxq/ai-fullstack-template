import { beforeEach, expect, it, vi } from 'vitest';
import Taro from './taro-mock';

const storage = new Map<string, unknown>();
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.doMock('@tarojs/taro', () => ({ default: Taro }));
  storage.clear();
  Taro.getStorageSync.mockImplementation((key: string) => storage.get(key));
  Taro.setStorageSync.mockImplementation((key: string, value: unknown) => storage.set(key, value));
  Taro.removeStorageSync.mockImplementation((key: string) => storage.delete(key));
});

it('restores an identified session once without changing its generation on foreground', async () => {
  storage.set('fullstack.miniprogram.session.v2', { token: 'persisted', userId: 7 });
  const auth = await import('../src/shared/api/auth-token');
  auth.hydrateAuthToken();
  const session = auth.getAuthSession();
  expect(session).toMatchObject({ userId: 7, token: 'persisted' });
  auth.hydrateAuthToken();
  expect(auth.getAuthSession()).toBe(session);
});

it('honors a durable signed-out marker on a fresh process even if token removal failed', async () => {
  let auth = await import('../src/shared/api/auth-token');
  auth.saveAuthSession('private', 7);
  Taro.removeStorageSync.mockImplementation(() => {
    throw new Error('disk');
  });
  expect(() => auth.clearAuthToken()).toThrow();
  expect(storage.get('fullstack.miniprogram.session.v2')).toEqual({ token: 'private', userId: 7 });
  vi.resetModules();
  auth = await import('../src/shared/api/auth-token');
  auth.hydrateAuthToken();
  expect(auth.getAuthSession()).toBeNull();
});

it('never restores a token-only legacy value or malformed account identifier', async () => {
  storage.set('fullstack.miniprogram.access-token.v1', 'legacy');
  storage.set('fullstack.miniprogram.session.v2', { token: 'broken', userId: '7' });
  const auth = await import('../src/shared/api/auth-token');
  auth.hydrateAuthToken();
  expect(auth.getAuthSession()).toBeNull();
});

it('fails closed if startup storage cannot be inspected', async () => {
  Taro.getStorageSync.mockImplementation(() => {
    throw new Error('read');
  });
  const auth = await import('../src/shared/api/auth-token');
  expect(() => auth.hydrateAuthToken()).toThrow('无法读取');
  expect(auth.getAuthSession()).toBeNull();
  Taro.getStorageSync.mockImplementation(() => ({ token: 'private', userId: 7 }));
  auth.hydrateAuthToken();
  expect(auth.getAuthSession()).toBeNull();
});
