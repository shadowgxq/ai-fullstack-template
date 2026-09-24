import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthToken, setAuthToken, setUnauthorizedHandler } from './auth-token';
import { attachAuthInterceptors } from './requestClient';

function clientWithStatus(status: number, beforeResponse?: () => void) {
  return attachAuthInterceptors(
    axios.create({
      adapter: async (config) => {
        beforeResponse?.();
        const response: AxiosResponse = { data: null, status, statusText: '', headers: {}, config };
        if (status === 401) {
          throw new AxiosError('Unauthorized', 'ERR_BAD_RESPONSE', config, undefined, response);
        }
        return response;
      },
    }),
  );
}

afterEach(() => {
  setAuthToken(null);
  setUnauthorizedHandler(null);
});

describe('authentication transport boundary', () => {
  it('preserves an explicitly supplied new token during login', async () => {
    setAuthToken('old-token');
    const response = await clientWithStatus(200).get('/me', {
      headers: { Authorization: 'Bearer new-token' },
    });
    expect(response.config.headers.get('Authorization')).toBe('Bearer new-token');
  });

  it('injects and invalidates only the currently authenticated token', async () => {
    const clear = vi.fn();
    setAuthToken('current-token');
    setUnauthorizedHandler(clear);
    await expect(clientWithStatus(401).get('/me')).rejects.toBeInstanceOf(AxiosError);
    expect(clear).toHaveBeenCalledOnce();
  });

  it('does not clear another session for an explicit request token', async () => {
    const clear = vi.fn();
    setAuthToken('current-token');
    setUnauthorizedHandler(clear);
    await expect(
      clientWithStatus(401).get('/me', { headers: { Authorization: 'Bearer rejected-token' } }),
    ).rejects.toBeInstanceOf(AxiosError);
    expect(clear).not.toHaveBeenCalled();
  });

  it('ignores a late 401 after a new session has replaced the old token', async () => {
    const clear = vi.fn();
    setAuthToken('old-token');
    setUnauthorizedHandler(clear);
    const client = clientWithStatus(401, () => setAuthToken('new-token'));
    await expect(client.get('/me')).rejects.toBeInstanceOf(AxiosError);
    expect(getAuthToken()).toBe('new-token');
    expect(clear).not.toHaveBeenCalled();
  });
});
