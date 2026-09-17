import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMeMock } = vi.hoisted(() => ({ getMeMock: vi.fn() }));
vi.mock('./auth.source', () => ({ authGateway: { getMe: getMeMock } }));

import { revalidateSession } from './auth.session';
import { useAuthStore } from './auth.store';
import type { AuthUser } from './auth.types';

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: '1',
    email: 'admin@example.com',
    ...over,
  };
}

describe('revalidateSession', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    getMeMock.mockReset();
  });

  it('无本地 token 时不发起回源请求', async () => {
    await revalidateSession();

    expect(getMeMock).not.toHaveBeenCalled();
  });

  it('回源成功后用服务端用户信息刷新会话（token 不变）', async () => {
    useAuthStore.getState().setSession('jwt-1', user({ email: 'old@example.com' }));
    getMeMock.mockResolvedValue(user({ email: 'new@example.com' }));

    await revalidateSession();

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-1');
    expect(state.user?.email).toBe('new@example.com');
  });

  it('非 401 失败（网络/5xx）保留本地会话', async () => {
    useAuthStore.getState().setSession('jwt-1', user());
    getMeMock.mockRejectedValue({ __apiError: true, message: 'boom', status: 500 });

    await revalidateSession();

    expect(useAuthStore.getState().token).toBe('jwt-1');
    expect(useAuthStore.getState().user?.email).toBe('admin@example.com');
  });

  it('401 时不在本地兜底恢复（拦截器负责清除）', async () => {
    useAuthStore.getState().setSession('jwt-1', user());
    getMeMock.mockImplementation(() => {
      // 模拟请求层行为：401 时拦截器先清除会话，再抛出错误
      useAuthStore.getState().clear();
      return Promise.reject({ __apiError: true, message: 'unauthorized', status: 401 });
    });

    await revalidateSession();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
