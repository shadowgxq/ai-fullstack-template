export { resolveAuthErrorText } from './model/auth.error-text';
export { AuthError, isAuthError, type AuthErrorCode, type AuthGateway } from './model/auth.gateway';
export {
  useEmailCodeLogin,
  useGoogleLogin,
  useLogout,
  usePasswordLogin,
  useRegister,
  useResetPassword,
  useSendEmailCode,
} from './model/auth.mutations';
export { revalidateSession } from './model/auth.session';
export { useAuthStore } from './model/auth.store';
export { useChangePasswordModal } from './model/change-password-modal.store';
export { useLoginModal } from './model/login-modal.store';
export type {
  AuthSession,
  AuthUser,
  EmailCodeScene,
  SendEmailCodeResult,
} from './model/auth.types';
export {
  EMAIL_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateEmailCode,
  validateNewPassword,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
} from './model/auth.validation';
export { AuthField, type AuthFieldProps } from './ui/AuthField';
export { AuthForm, type AuthFormProps } from './ui/AuthForm';
export {
  ChangePasswordForm,
  ChangePasswordModal,
  type ChangePasswordFormProps,
} from './ui/ChangePasswordModal';
export { LoginModal } from './ui/LoginModal';

export { authCapabilities } from './model/auth.capabilities';
