import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  useAuthStore,
  useLoginModal,
  useResetPassword,
  useSendEmailCode,
} from '../../features/auth';
import { isAuthError } from '../../features/auth/model/auth.gateway';
import { Eye, EyeOff } from '../../shared/icons';
import { AppShell } from '../../widgets/app-shell';
import { maskEmail } from './maskEmail';
import styles from './ForgotPasswordPage.module.css';

const RESEND_COOLDOWN_SECONDS = 60;
/** 与 AuthForm 保持一致；后端契约冻结前只做本地校验。 */
const PASSWORD_MIN_LENGTH = 8;

type Step = 'request' | 'reset' | 'done';

/**
 * 找回密码（验证码三段式）：输入邮箱发码 → 验证码 + 新密码 → 完成后引导登录。
 *
 * 这不只是「忘了密码」的兜底：存量用户的密码在建号时被设为随机 UUID 且从未告知，
 * 本页是他们启用密码登录的唯一途径。发送侧复用 email-code/send 的 RESET_PASSWORD
 * 场景（后端枚举已存在）；提交侧走 password-reset/confirm。
 *
 * 登录态进入本页即「修改密码」：产品选择复用这条链路而不是新开一个带旧密码的接口，
 * 因为验证码建号/Google 建号的用户本就没有可用旧密码，旧密码式改密对他们无效。
 * 已知限制：后端确认接口不失效已签发的 token，改密码不会踢掉其它设备的会话。
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openLogin = useLoginModal((state) => state.openLogin);
  const accountEmail = useAuthStore((state) => state.user?.email) ?? '';
  const isChangeMode = accountEmail.length > 0;

  const [step, setStep] = useState<Step>('request');
  const [typedEmail, setTypedEmail] = useState('');
  // 登录态下邮箱不是可编辑状态而是账号属性，直接派生：会话晚到（persist 回填 /
  // revalidate）时自然跟上，不需要拿 effect 往 state 里同步。
  const email = isChangeMode ? accountEmail : typedEmail;
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const sendCode = useSendEmailCode();
  const resetPassword = useResetPassword();

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const isBusy = sendCode.isPending || resetPassword.isPending;

  const activeError = resetPassword.error ?? sendCode.error ?? null;
  let errorText: string | null = localError;
  if (!errorText && activeError) {
    if (isAuthError(activeError) && activeError.code !== 'generic') {
      errorText = t(`auth.errors.${activeError.code}`);
    } else if (isAuthError(activeError) && activeError.serverMessage) {
      errorText = activeError.serverMessage;
    } else {
      errorText = t('auth.errors.generic');
    }
  }

  function requestCode() {
    // 本地校验先于提交：格式问题不值得跑一次网络往返。
    if (!email.trim().includes('@')) {
      setLocalError(t('auth.errors.INVALID_EMAIL'));
      return;
    }
    setLocalError(null);
    sendCode.mutate(
      { email: email.trim(), scene: 'RESET_PASSWORD' },
      {
        onSuccess: () => {
          setStep('reset');
          setCooldown(RESEND_COOLDOWN_SECONDS);
        },
      },
    );
  }

  function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    requestCode();
  }

  function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setLocalError(t('auth.errors.PASSWORD_TOO_SHORT', { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError(t('auth.errors.PASSWORD_MISMATCH'));
      return;
    }
    setLocalError(null);
    resetPassword.mutate(
      { email: email.trim(), code: code.trim(), newPassword },
      { onSuccess: () => setStep('done') },
    );
  }

  /** 完成后回首页并拉起登录弹窗，用户就地用新密码登录。 */
  function goLogin() {
    navigate('/', { replace: true });
    openLogin();
  }

  /** 修改密码形态：会话未失效，回首页即可，不必再登一次。 */
  function goHome() {
    navigate('/', { replace: true });
  }

  return (
    <AppShell>
      <main className={styles.main}>
        <div className={styles.card}>
          {step === 'request' ? (
            <>
              <h1 className={styles.title}>
                {t(isChangeMode ? 'auth.changePassword.title' : 'auth.forgot.title')}
              </h1>
              <p className={styles.subtitle}>
                {t(isChangeMode ? 'auth.changePassword.subtitle' : 'auth.forgot.subtitle')}
              </p>
              <form className={styles.form} onSubmit={handleRequestSubmit} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-email">
                    {t('auth.email.label')}
                  </label>
                  <input
                    id="forgot-email"
                    className={styles.input}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setTypedEmail(event.target.value)}
                    placeholder={t('auth.email.placeholder')}
                    // 登录态是「改我自己的密码」，邮箱锁死为账号邮箱
                    readOnly={isChangeMode}
                  />
                </div>
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={isBusy || !email.trim()}
                >
                  {sendCode.isPending ? t('auth.loading') : t('auth.forgot.send')}
                </button>
              </form>
            </>
          ) : null}

          {step === 'reset' ? (
            <>
              <h1 className={styles.title}>{t('auth.forgot.sentTitle')}</h1>
              {/* 防枚举：不论邮箱是否注册，文案都只说「如果已注册」。 */}
              <p className={styles.subtitle}>
                {t('auth.forgot.sentBody', { email: maskEmail(email.trim()) })}
              </p>
              <form className={styles.form} onSubmit={handleResetSubmit} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-code">
                    {t('auth.forgot.codeLabel')}
                  </label>
                  <input
                    id="forgot-code"
                    className={styles.input}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder={t('auth.email.codePlaceholder')}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-new-password">
                    {t('auth.forgot.newPasswordLabel')}
                  </label>
                  <div className={styles.passwordShell}>
                    <input
                      id="forgot-new-password"
                      className={styles.input}
                      type={isPasswordVisible ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder={t('auth.register.passwordPlaceholder', {
                        min: PASSWORD_MIN_LENGTH,
                      })}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      aria-label={t(isPasswordVisible ? 'auth.password.hide' : 'auth.password.show')}
                      aria-pressed={isPasswordVisible}
                      onClick={() => setIsPasswordVisible((visible) => !visible)}
                    >
                      {isPasswordVisible ? (
                        <EyeOff size={18} aria-hidden="true" />
                      ) : (
                        <Eye size={18} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-confirm-password">
                    {t('auth.register.confirmLabel')}
                  </label>
                  <input
                    id="forgot-confirm-password"
                    className={styles.input}
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t('auth.register.confirmPlaceholder')}
                  />
                </div>
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={isBusy || !code.trim() || !newPassword || !confirmPassword}
                >
                  {resetPassword.isPending ? t('auth.loading') : t('auth.forgot.submit')}
                </button>
              </form>
              <button
                type="button"
                className={styles.inlineLink}
                disabled={cooldown > 0 || isBusy}
                onClick={requestCode}
              >
                {cooldown > 0
                  ? t('auth.forgot.resendWait', { seconds: cooldown })
                  : t('auth.forgot.resend')}
              </button>
            </>
          ) : null}

          {step === 'done' ? (
            <>
              <h1 className={styles.title}>{t('auth.forgot.doneTitle')}</h1>
              <p className={styles.subtitle}>
                {t(isChangeMode ? 'auth.changePassword.doneBody' : 'auth.forgot.doneBody')}
              </p>
              <button
                type="button"
                className={styles.submit}
                onClick={isChangeMode ? goHome : goLogin}
              >
                {t(isChangeMode ? 'auth.changePassword.back' : 'auth.forgot.goLogin')}
              </button>
            </>
          ) : null}

          {errorText ? (
            <p className={styles.error} role="alert">
              {errorText}
            </p>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
