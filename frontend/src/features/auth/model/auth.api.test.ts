import { beforeEach, describe, expect, it, vi } from 'vitest';
const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../../../shared/api', () => ({
  request: requestMock,
  isApiError: (error: unknown) => Boolean((error as { __apiError?: boolean } | null)?.__apiError),
}));
const { apiAuthGateway } = await import('./auth.api');
const input = { username: 'alice_9f2c', password: 'Passw0rd!' };
const success = (data: unknown) => ({ code: 0, message: 'success', data });
describe('actual fullstack auth contract', () => {
  beforeEach(() => requestMock.mockReset());
  it('logs in then maps the actual user without guessing roles or token lifetime', async () => {
    requestMock
      .mockResolvedValueOnce(success({ access_token: 'token', token_type: 'bearer' }))
      .mockResolvedValueOnce(success({ id: 1, username: input.username }));
    const session = await apiAuthGateway.passwordLogin(input);
    expect(requestMock).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/v1/auth/login',
      data: input,
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      url: '/v1/auth/me',
      data: undefined,
      headers: { Authorization: 'Bearer token' },
    });
    expect(session.user).toMatchObject({
      userId: '1',
      username: input.username,
      admin: false,
      email: null,
    });
    expect(session).not.toHaveProperty('expiresIn');
  });
  it('registers only supported fields, then establishes a real session', async () => {
    requestMock
      .mockResolvedValueOnce(success({ id: 2, username: input.username }))
      .mockResolvedValueOnce(success({ access_token: 'new', token_type: 'bearer' }))
      .mockResolvedValueOnce(success({ id: 2, username: input.username }));
    expect((await apiAuthGateway.register({ ...input, email: '', code: '' })).newUser).toBe(true);
    expect(requestMock.mock.calls[0][0].data).toEqual(input);
  });
  it.each([
    [40001, 400, 'USERNAME_TAKEN'],
    [40101, 401, 'INVALID_CREDENTIALS'],
    [42901, 429, 'RATE_LIMITED'],
    [50301, 503, 'generic'],
  ])('maps backend code %s without hiding service failure', async (code, status, expected) => {
    requestMock.mockRejectedValue({
      __apiError: true,
      code,
      status,
      message: 'safe',
      messageFromServer: true,
    });
    await expect(apiAuthGateway.passwordLogin(input)).rejects.toMatchObject({
      code: expected,
      serverCode: code,
    });
  });
  it('rejects nonzero envelopes instead of treating their data as success', async () => {
    requestMock.mockResolvedValue({ code: 40001, message: 'exists', data: null });
    await expect(apiAuthGateway.register({ ...input, email: '', code: '' })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });
  it('does not call nonexistent backend capabilities', async () => {
    await expect(
      apiAuthGateway.sendEmailCode({ email: 'test@example.com', scene: 'login_register' }),
    ).rejects.toThrow();
    await expect(apiAuthGateway.googleLogin({ credential: 'test' })).rejects.toThrow();
    expect(requestMock).not.toHaveBeenCalled();
  });
  it('does not return a successful logout when revocation fails', async () => {
    requestMock.mockRejectedValue({ __apiError: true, code: 50301, status: 503 });
    await expect(apiAuthGateway.logout()).rejects.toThrow();
  });
  it('rejects incomplete user responses', async () => {
    requestMock.mockResolvedValue(success({ username: 'missing-id' }));
    await expect(apiAuthGateway.getMe?.()).rejects.toThrow();
  });
});
