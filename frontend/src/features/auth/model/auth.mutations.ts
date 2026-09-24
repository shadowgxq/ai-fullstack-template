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
  SendEmailCodeResult,
} from './auth.types';

function useSessionMutation<TInput>(
  mutationFn: (input: TInput) => Promise<AuthSession>,
): UseMutationResult<AuthSession, Error, TInput> {
  const setSession = useAuthStore((state) => state.setSession);
  return useMutation({
    mutationFn,
    onSuccess: (session) => setSession(session.token, session.user),
  });
}

export function useSendEmailCode(): UseMutationResult<
  SendEmailCodeResult,
  Error,
  SendEmailCodeInput
> {
  return useMutation({ mutationFn: (input) => authGateway.sendEmailCode(input) });
}

export function useEmailCodeLogin(): UseMutationResult<AuthSession, Error, EmailCodeLoginInput> {
  return useSessionMutation((input) => authGateway.emailCodeLogin(input));
}

export function usePasswordLogin(): UseMutationResult<AuthSession, Error, PasswordLoginInput> {
  return useSessionMutation((input) => authGateway.passwordLogin(input));
}

export function useRegister(): UseMutationResult<AuthSession, Error, RegisterInput> {
  return useSessionMutation((input) => authGateway.register(input));
}

export function useResetPassword(): UseMutationResult<void, Error, ResetPasswordInput> {
  return useMutation({ mutationFn: (input) => authGateway.resetPassword(input) });
}

export function useGoogleLogin(): UseMutationResult<AuthSession, Error, GoogleLoginInput> {
  return useSessionMutation((input) => authGateway.googleLogin(input));
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const clear = useAuthStore((state) => state.clear);
  return useMutation({
    mutationFn: () => authGateway.logout(),
    onSuccess: () => clear(),
  });
}
