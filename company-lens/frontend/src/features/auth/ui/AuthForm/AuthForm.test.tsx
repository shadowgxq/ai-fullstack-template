import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import { AuthError } from '../../model/auth.gateway';
import { AuthForm } from './AuthForm';

const mutationMocks = vi.hoisted(() => {
  function createMutationMock() {
    const mutation = {
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      error: null as Error | null,
    };
    mutation.reset.mockImplementation(() => {
      mutation.error = null;
    });
    return mutation;
  }

  return {
    emailCodeLogin: createMutationMock(),
    sendEmailCode: createMutationMock(),
    passwordLogin: createMutationMock(),
    register: createMutationMock(),
    googleLogin: createMutationMock(),
  };
});

const emailCodeLoginMock = mutationMocks.emailCodeLogin.mutate;
const sendEmailCodeMock = mutationMocks.sendEmailCode.mutate;
const passwordLoginMock = mutationMocks.passwordLogin.mutate;
const registerMock = mutationMocks.register.mutate;
const googleLoginMock = mutationMocks.googleLogin.mutate;

// 非测试代码只从 shared/config 取 runtimeConfig，整模块替换不会牵连 requestClient 等下游。
const mocks = vi.hoisted(() => ({
  runtimeConfig: {
    api: { baseUrl: '/api', timeoutMs: 10000 },
    dataSource: 'mock' as 'mock' | 'api',
    researchDataSource: 'mock' as 'mock' | 'api',
    googleClientId: 'test-client-id' as string | undefined,
    googleAuthMode: 'idtoken' as 'code' | 'idtoken',
  },
}));
vi.mock('../../../../shared/config', () => ({ runtimeConfig: mocks.runtimeConfig }));

vi.mock('../../model/auth.mutations', () => ({
  useEmailCodeLogin: () => {
    const [, forceRender] = useState(0);
    mutationMocks.emailCodeLogin.reset.mockImplementation(() => {
      mutationMocks.emailCodeLogin.error = null;
      forceRender((version) => version + 1);
    });
    return mutationMocks.emailCodeLogin;
  },
  useSendEmailCode: () => {
    const [, forceRender] = useState(0);
    mutationMocks.sendEmailCode.reset.mockImplementation(() => {
      mutationMocks.sendEmailCode.error = null;
      forceRender((version) => version + 1);
    });
    return mutationMocks.sendEmailCode;
  },
  usePasswordLogin: () => {
    const [, forceRender] = useState(0);
    mutationMocks.passwordLogin.reset.mockImplementation(() => {
      mutationMocks.passwordLogin.error = null;
      forceRender((version) => version + 1);
    });
    return mutationMocks.passwordLogin;
  },
  useRegister: () => {
    const [, forceRender] = useState(0);
    mutationMocks.register.reset.mockImplementation(() => {
      mutationMocks.register.error = null;
      forceRender((version) => version + 1);
    });
    return mutationMocks.register;
  },
  useGoogleLogin: () => {
    const [, forceRender] = useState(0);
    mutationMocks.googleLogin.reset.mockImplementation(() => {
      mutationMocks.googleLogin.error = null;
      forceRender((version) => version + 1);
    });
    return mutationMocks.googleLogin;
  },
}));

// 隔离 GIS 脚本加载：本用例只验证表单自身的校验与提交行为。
vi.mock('../GoogleLoginButton', () => ({
  GoogleLoginButton: () => <div data-testid="google-login-button" />,
}));

function renderForm() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuthForm onAuthenticated={() => {}} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('AuthForm', () => {
  beforeEach(async () => {
    emailCodeLoginMock.mockClear();
    sendEmailCodeMock.mockClear();
    passwordLoginMock.mockClear();
    registerMock.mockClear();
    googleLoginMock.mockClear();
    Object.values(mutationMocks).forEach((mutation) => {
      mutation.error = null;
      mutation.reset.mockClear();
    });
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('submits email and verification code', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in / Sign up' }));

    expect(emailCodeLoginMock.mock.calls[0][0]).toEqual({
      email: 'a@example.com',
      code: '123456',
    });
  });

  it('sends the verification code with the email and LOGIN scene', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(sendEmailCodeMock.mock.calls[0][0]).toEqual({
      email: 'a@example.com',
      scene: 'LOGIN',
    });
  });

  // 需求底稿 18.5：邮箱 + 密码。注意请求体是 email 而非 username——
  // 与后端现存的管理员 password-login（收 username）不是同一契约。
  it('密码模式提交邮箱与密码', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Password' }));
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(passwordLoginMock.mock.calls[0][0]).toEqual({
      email: 'a@example.com',
      password: 'secret-pass-1',
    });
  });

  it('密码模式提供忘记密码入口，指向独立路由页', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Password' }));

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('切换登录 tab 时隐藏已有的服务端错误', async () => {
    mutationMocks.passwordLogin.error = new AuthError('INVALID_CREDENTIALS');
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect');

    await userEvent.click(screen.getByRole('button', { name: 'Password' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mutationMocks.passwordLogin.reset).toHaveBeenCalledTimes(1);
  });

  it('编辑输入框时隐藏已有的服务端错误', async () => {
    mutationMocks.passwordLogin.error = new AuthError('INVALID_CREDENTIALS');
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect');

    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mutationMocks.passwordLogin.reset).toHaveBeenCalledTimes(1);
  });

  it('注册校验：两次密码不一致时就地报错，不发请求', async () => {
    renderForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'New here? Create an account with a password' }),
    );
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('Set a password'), 'password-1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-2');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(registerMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("The two passwords don't match");
  });

  it('注册校验：未勾用户协议时就地报错，不发请求', async () => {
    renderForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'New here? Create an account with a password' }),
    );
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.type(screen.getByLabelText('Set a password'), 'password-1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(registerMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please agree to the Terms of Service first',
    );
  });

  // 注册发码走 REGISTER 场景（登录 tab 是 LOGIN），后端归一化到同一验证码池。
  it('注册模式发送验证码使用 REGISTER 场景', async () => {
    renderForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'New here? Create an account with a password' }),
    );
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(sendEmailCodeMock.mock.calls[0][0]).toEqual({
      email: 'new@example.com',
      scene: 'REGISTER',
    });
  });

  // 需求底稿 18.4 全项 + 2026-08-05 拍板的邮箱验证码。
  it('注册全项通过后提交 email、code 与 password', async () => {
    renderForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'New here? Create an account with a password' }),
    );
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Verification code'), '654321');
    await userEvent.type(screen.getByLabelText('Set a password'), 'password-1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password-1');
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'I have read and agree to the Terms of Service' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(registerMock.mock.calls[0][0]).toEqual({
      email: 'new@example.com',
      code: '654321',
      password: 'password-1',
    });
  });
});

/**
 * 未配 client id 时 GoogleLoginButton 会降级成演示按钮，点一下发 credential:
 * 'mock-google-credential'。这对 mock 数据源是有用的本地通路，对真实后端却是必然失败的
 * 假凭据——2026-08-06 行业发现线上就是这么坏的：部署漏配 VITE_GOOGLE_CLIENT_ID，构建
 * 产物静默降级，用户点完只看到一句「Google ID token 无效」。
 * 该组合下入口整个不出现，比给一个必坏的按钮好。
 */
describe('AuthForm Google 入口可用性', () => {
  beforeEach(async () => {
    mocks.runtimeConfig.dataSource = 'mock';
    mocks.runtimeConfig.googleClientId = 'test-client-id';
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('真实数据源下漏配 client id 时不渲染 Google 入口', () => {
    mocks.runtimeConfig.dataSource = 'api';
    mocks.runtimeConfig.googleClientId = undefined;

    renderForm();

    expect(screen.queryByTestId('google-login-button')).not.toBeInTheDocument();
  });

  it('真实数据源下配了 client id 时正常渲染', () => {
    mocks.runtimeConfig.dataSource = 'api';

    renderForm();

    expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
  });

  it('mock 数据源下即使没有 client id 也保留演示入口', () => {
    mocks.runtimeConfig.googleClientId = undefined;

    renderForm();

    expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
  });
});
