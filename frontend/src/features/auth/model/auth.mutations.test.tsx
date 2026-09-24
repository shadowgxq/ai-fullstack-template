import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLogout } from './auth.mutations';
import { useAuthStore } from './auth.store';

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('./auth.source', () => ({ authGateway: { logout } }));

function mountLogout() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useLogout(), { wrapper }), client };
}

beforeEach(() => {
  logout.mockReset();
  useAuthStore.getState().setSession('session-token', {
    userId: '1',
    username: 'alice_9f2c',
    nickname: 'alice_9f2c',
    email: null,
    avatar: null,
    role: 'user',
    admin: false,
  });
});

describe('logout revocation result', () => {
  it('keeps the session available for retry when backend revocation fails', async () => {
    logout.mockRejectedValue(new Error('revocation unavailable'));
    const { result, client } = mountLogout();
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('revocation unavailable');
    });
    expect(useAuthStore.getState().token).toBe('session-token');
    client.clear();
  });

  it('clears the session only after confirmed successful revocation', async () => {
    logout.mockResolvedValue(undefined);
    const { result, client } = mountLogout();
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(useAuthStore.getState().token).toBeNull();
    client.clear();
  });
});
