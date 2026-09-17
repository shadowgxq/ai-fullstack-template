import { describe, expect, it } from 'vitest';

import { createMockAuthGateway } from './auth.mock';

describe('mock 认证网关', () => {
  it('发送注册验证码不抛错', async () => {
    const gateway = createMockAuthGateway();
    await expect(
      gateway.sendEmailCode({ email: 'new@example.com', scene: 'REGISTER' }),
    ).resolves.toBeUndefined();
  });

  it('邮箱格式非法时发送验证码抛出 INVALID_EMAIL', async () => {
    const gateway = createMockAuthGateway();
    await expect(
      gateway.sendEmailCode({ email: 'not-an-email', scene: 'REGISTER' }),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
  });

  it('首次用验证码登录即注册，newUser 为 true', async () => {
    const gateway = createMockAuthGateway();
    await gateway.sendEmailCode({ email: 'new@example.com', scene: 'REGISTER' });
    const session = await gateway.emailCodeLogin({ email: 'new@example.com', code: '123456' });
    expect(session.newUser).toBe(true);
    expect(session.user.email).toBe('new@example.com');
  });

  it('已存在账户用验证码登录时 newUser 为 false', async () => {
    const gateway = createMockAuthGateway();
    await gateway.sendEmailCode({ email: 'demo@example.com', scene: 'LOGIN' });
    const session = await gateway.emailCodeLogin({ email: 'demo@example.com', code: '123456' });
    expect(session.newUser).toBe(false);
  });

  it('验证码不是 6 位数字时抛出 INVALID_CODE', async () => {
    const gateway = createMockAuthGateway();
    await expect(
      gateway.emailCodeLogin({ email: 'demo@example.com', code: 'abc' }),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });

  it('每个实例状态独立，同一邮箱可在不同实例分别首次注册', async () => {
    const first = createMockAuthGateway();
    const second = createMockAuthGateway();
    await first.emailCodeLogin({ email: 'shared@example.com', code: '123456' });
    const session = await second.emailCodeLogin({ email: 'shared@example.com', code: '123456' });
    expect(session.newUser).toBe(true);
  });

  it('Google 登录返回会话，首次为新用户', async () => {
    const gateway = createMockAuthGateway();
    const session = await gateway.googleLogin({ credential: 'fake-gis-credential' });
    expect(session.newUser).toBe(true);
    // 必须精确断言邮箱：toBeTruthy() 挡不住把 credential 误当邮箱建会话的身份错配。
    expect(session.user.email).toBe('google-user@example.com');
  });

  it('同一实例内再次 Google 登录不再是新用户', async () => {
    const gateway = createMockAuthGateway();
    await gateway.googleLogin({ credential: 'fake-gis-credential' });
    const session = await gateway.googleLogin({ credential: 'fake-gis-credential' });
    expect(session.newUser).toBe(false);
    expect(session.user.email).toBe('google-user@example.com');
  });

  it('空 credential 抛出 generic', async () => {
    const gateway = createMockAuthGateway();
    await expect(gateway.googleLogin({ credential: '' })).rejects.toMatchObject({
      code: 'generic',
    });
  });

  it('密码注册即自动登录，newUser 为 true', async () => {
    const gateway = createMockAuthGateway();
    const session = await gateway.register({ email: 'pw@example.com', code: '123456', password: 'password-1' });
    expect(session.newUser).toBe(true);
    expect(session.user.email).toBe('pw@example.com');
  });

  it('邮箱已被占用（含验证码建的号）时注册抛 EMAIL_ALREADY_REGISTERED', async () => {
    const gateway = createMockAuthGateway();
    await expect(
      gateway.register({ email: 'demo@example.com', code: '123456', password: 'password-1' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  // 占号防线：验证码不对就建不了号，先于「已注册」检查（枚举口子也一并封掉）。
  it('注册验证码不是 6 位数字时抛 INVALID_CODE', async () => {
    const gateway = createMockAuthGateway();
    await expect(
      gateway.register({ email: 'pw2@example.com', code: 'abc', password: 'password-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });

  it('密码注册后可用同一组邮箱密码登录', async () => {
    const gateway = createMockAuthGateway();
    await gateway.register({ email: 'pw@example.com', code: '123456', password: 'password-1' });
    const session = await gateway.passwordLogin({ email: 'pw@example.com', password: 'password-1' });
    expect(session.newUser).toBe(false);
    expect(session.user.email).toBe('pw@example.com');
  });

  // 与真实后端一致：验证码建的号密码是随机 UUID，不存在「猜得中」的密码。
  it('验证码建的号没有可用密码，密码登录抛 INVALID_CREDENTIALS', async () => {
    const gateway = createMockAuthGateway();
    await gateway.emailCodeLogin({ email: 'code-only@example.com', code: '123456' });
    await expect(
      gateway.passwordLogin({ email: 'code-only@example.com', password: 'anything' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  // 找回密码是存量账户启用密码登录的唯一途径。
  it('找回密码后原本无密码的账户可以密码登录', async () => {
    const gateway = createMockAuthGateway();
    await gateway.emailCodeLogin({ email: 'legacy@example.com', code: '123456' });
    await gateway.resetPassword({
      email: 'legacy@example.com',
      code: '654321',
      newPassword: 'fresh-pass-1',
    });
    const session = await gateway.passwordLogin({
      email: 'legacy@example.com',
      password: 'fresh-pass-1',
    });
    expect(session.user.email).toBe('legacy@example.com');
  });

  it('重置密码的验证码不是 6 位数字时抛 INVALID_CODE', async () => {
    const gateway = createMockAuthGateway();
    await expect(
      gateway.resetPassword({ email: 'legacy@example.com', code: 'abc', newPassword: 'p-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });
});
