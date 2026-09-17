import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { authGateway } from './auth.source';
import { useAuthStore } from './auth.store';
import type {
  AuthSession,
  EmailCodeLoginInput,
  GoogleLoginInput,
  PasswordLoginInput,
  RegisterInput,
  ResetPasswordInput,
  SendEmailCodeInput,
} from './auth.types';

function useSessionMutation<TInput>(
  mutationFn: (input: TInput) => Promise<AuthSession>,
): UseMutationResult<AuthSession, Error, TInput> {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn,
    onSuccess: (session) => {
      setSession(session.token, session.user);
    },
  });
}

export function useSendEmailCode(): UseMutationResult<void, Error, SendEmailCodeInput> {
  return useMutation({
    mutationFn: (input: SendEmailCodeInput) => authGateway.sendEmailCode(input),
  });
}

export function useEmailCodeLogin(): UseMutationResult<AuthSession, Error, EmailCodeLoginInput> {
  return useSessionMutation((input) => authGateway.emailCodeLogin(input));
}

/** 注册成功即登录（需求底稿 18.4「自动登录」），因此同样走会话 mutation。 */
export function useRegister(): UseMutationResult<AuthSession, Error, RegisterInput> {
  return useSessionMutation((input) => authGateway.register(input));
}

export function usePasswordLogin(): UseMutationResult<AuthSession, Error, PasswordLoginInput> {
  return useSessionMutation((input) => authGateway.passwordLogin(input));
}

/** 重置密码不建立会话——完成后由页面引导用户用新密码登录。 */
export function useResetPassword(): UseMutationResult<void, Error, ResetPasswordInput> {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authGateway.resetPassword(input),
  });
}

export function useGoogleLogin(): UseMutationResult<AuthSession, Error, GoogleLoginInput> {
  return useSessionMutation((input) => authGateway.googleLogin(input));
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const clear = useAuthStore((state) => state.clear);
  return useMutation({
    mutationFn: () => authGateway.logout(),
    // 服务端登出失败（如 token 已过期）也要清除本地会话。
    onSettled: () => {
      clear();
    },
  });
}
