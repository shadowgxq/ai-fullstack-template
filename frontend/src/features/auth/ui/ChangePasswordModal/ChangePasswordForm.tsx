import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { KeyRound, LockKeyhole, Mail } from '../../../../shared/icons';
import { resolveAuthErrorText } from '../../model/auth.error-text';
import { useResetPassword, useSendEmailCode } from '../../model/auth.mutations';
import { useAuthStore } from '../../model/auth.store';
import {
  validateEmailCode,
  validateNewPassword,
  validatePasswordConfirmation,
} from '../../model/auth.validation';
import { AuthField } from '../AuthField';
import { Button } from '@/shared/ui/button';

type ErrorField = 'code' | 'password' | 'confirm';

export type ChangePasswordFormProps = {
  /** 修改成功后由调用方决定收尾（关闭弹窗等）。 */
  onDone?: () => void;
};

/**
 * 修改密码走的是「验证码 + 新密码」这条链路，而不是常见的「旧密码 + 新密码」。
 *
 * 原因是账号体系里存在没有旧密码的用户：验证码首次登录会直接建号，Google 登录
 * 同理，这两类用户从未设置过密码，旧密码式改密对他们无效。后端也只提供
 * `/password/reset` 一个改密入口，前端不另造接口。
 */
export function ChangePasswordForm({ onDone }: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  // 邮箱是会话的派生值而不是本地 state：会话晚于首帧到达时能自然跟上，
  // 也不需要在 effect 里回填 state。登录态语义是「改我自己的密码」，
  // 因此该字段只读，不允许改成别人的邮箱。
  const accountEmail = user?.email ?? null;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<{ field: ErrorField; text: string } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [expireSeconds, setExpireSeconds] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [done, setDone] = useState(false);

  const sendCode = useSendEmailCode();
  const resetPassword = useResetPassword();

  const ticking = cooldown > 0;
  const codeSent = sentTo !== null && sentTo === accountEmail?.toLowerCase();

  useEffect(() => {
    if (!ticking) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const requestError = sendCode.error ?? resetPassword.error ?? null;
  const message = resolveAuthErrorText(requestError, t);
  const fieldError = (field: ErrorField) =>
    formError?.field === field ? formError.text : undefined;
  const expireMinutes = Math.max(1, Math.ceil(expireSeconds / 60));

  function failField(field: ErrorField, errorCode: string) {
    setFormError({ field, text: t(`auth.errors.${errorCode}`) });
  }

  function resetFeedback() {
    setFormError(null);
    sendCode.reset();
    resetPassword.reset();
  }

  function sendLabel() {
    if (sendCode.isPending) return t('auth.submitting');
    if (codeSent && ticking) return t('auth.resendIn', { seconds: cooldown });
    return t(codeSent ? 'auth.resendCode' : 'auth.sendCode');
  }

  function handleSendCode() {
    if (!accountEmail) return;
    resetFeedback();

    sendCode.mutate(
      { email: accountEmail, scene: 'reset_password' },
      {
        onSuccess: (result) => {
          setSentTo(accountEmail.toLowerCase());
          setCooldown(result.cooldownSeconds);
          setExpireSeconds(result.expireSeconds);
        },
      },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accountEmail) return;
    resetFeedback();

    const checks: Array<[ErrorField, string | null]> = [
      ['code', validateEmailCode(code)],
      ['password', validateNewPassword(password)],
      ['confirm', validatePasswordConfirmation(password, confirmPassword)],
    ];
    const firstProblem = checks.find(([, problem]) => problem !== null);
    if (firstProblem && firstProblem[1]) {
      failField(firstProblem[0], firstProblem[1]);
      return;
    }

    resetPassword.mutate(
      { email: accountEmail, code: code.trim(), newPassword: password },
      {
        onSuccess: () => {
          setCode('');
          setPassword('');
          setConfirmPassword('');
          setDone(true);
        },
      },
    );
  }

  if (!user) {
    return (
      <p
        className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-muted-foreground"
        role="alert"
      >
        {t('auth.changePassword.authRequired')}
      </p>
    );
  }

  if (!accountEmail) {
    return (
      <p
        className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-muted-foreground"
        role="alert"
      >
        {t('auth.changePassword.noEmail')}
      </p>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-[var(--space-3)]">
        <p
          className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-success"
          role="status"
        >
          {t('auth.changePassword.done')}
        </p>
        {/* 已知限制明写出来，不藏：后端不失效已签发 token，改密不会踢掉其它设备。 */}
        <p className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-muted-foreground">
          {t('auth.changePassword.sessionNotice')}
        </p>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('auth.close')}
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-[var(--form-group-gap)]" onSubmit={handleSubmit} noValidate>
      <AuthField
        id="change-password-email"
        type="email"
        label={t('auth.changePassword.emailLabel')}
        value={accountEmail}
        onChange={() => {}}
        autoComplete="email"
        icon={Mail}
        readOnly
      />

      <AuthField
        id="change-password-code"
        type="text"
        label={t('auth.code')}
        value={code}
        onChange={setCode}
        error={fieldError('code')}
        placeholder={t('auth.codePlaceholder')}
        autoComplete="one-time-code"
        icon={KeyRound}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={handleSendCode}
            disabled={sendCode.isPending || (codeSent && ticking)}
            loading={sendCode.isPending}
          >
            {sendLabel()}
          </Button>
        }
      />

      {codeSent ? (
        <div
          className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-control)] bg-muted px-[var(--space-3)] py-[var(--space-2)]"
          role="status"
        >
          <p className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-foreground [overflow-wrap:anywhere]">
            {t('auth.codeSent', { email: accountEmail })}
          </p>
          <p className="text-[var(--font-size-xs)] leading-[var(--line-height-sm)] text-muted-foreground">
            {t('auth.codeExpiresIn', { minutes: expireMinutes })}
          </p>
        </div>
      ) : null}

      <AuthField
        id="change-password-new"
        type="password"
        label={t('auth.forgot.newPasswordLabel')}
        value={password}
        onChange={setPassword}
        error={fieldError('password')}
        placeholder={t('auth.register.passwordPlaceholder')}
        autoComplete="new-password"
        icon={LockKeyhole}
        showPasswordLabel={t('auth.showPassword')}
        hidePasswordLabel={t('auth.hidePassword')}
      />

      <AuthField
        id="change-password-confirm"
        type="password"
        label={t('auth.register.confirmLabel')}
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={fieldError('confirm')}
        placeholder={t('auth.register.confirmPlaceholder')}
        autoComplete="new-password"
        icon={LockKeyhole}
      />

      {message ? (
        <p
          className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-destructive"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        loading={resetPassword.isPending}
        disabled={!code.trim() || !password || !confirmPassword}
      >
        {t('auth.changePassword.submit')}
      </Button>
    </form>
  );
}
