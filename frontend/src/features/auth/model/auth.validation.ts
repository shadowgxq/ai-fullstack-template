import type { AuthErrorCode } from './auth.gateway';

export const EMAIL_CODE_LENGTH = 6;
export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_CODE_PATTERN = /^\d{6}$/;

export function validateEmail(email: string): AuthErrorCode | null {
  return EMAIL_PATTERN.test(email.trim()) ? null : 'INVALID_EMAIL';
}

export function validateEmailCode(code: string): AuthErrorCode | null {
  return EMAIL_CODE_PATTERN.test(code.trim()) ? null : 'INVALID_CODE';
}

export function validatePassword(password: string): AuthErrorCode | null {
  return password.length > 0 && new TextEncoder().encode(password).length <= 72
    ? null
    : 'INVALID_CREDENTIALS';
}

export function validateNewPassword(password: string): AuthErrorCode | null {
  return validatePassword(password) === null ? null : 'PASSWORD_WEAK';
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): AuthErrorCode | null {
  return password === confirmation ? null : 'PASSWORD_MISMATCH';
}

export function validateUsername(username: string): AuthErrorCode | null {
  return username.trim().length > 0 && [...username].length <= 50 ? null : 'USERNAME_INVALID';
}
