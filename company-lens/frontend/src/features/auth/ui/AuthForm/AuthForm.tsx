import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../../../../shared/api';
import { runtimeConfig } from '../../../../shared/config';
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail } from '../../../../shared/icons';
import { isAuthError } from '../../model/auth.gateway';
import type { GoogleLoginInput } from '../../model/auth.types';
import {
  useEmailCodeLogin,
  useGoogleLogin,
  usePasswordLogin,
  useRegister,
  useSendEmailCode,
} from '../../model/auth.mutations';
import { useLoginModal } from '../../model/login-modal.store';
import { GoogleLoginButton } from '../GoogleLoginButton';
import styles from './AuthForm.module.css';

/** 发送验证码后的本地冷却秒数；后端契约未给出该值，暂用固定值。 */
const RESEND_COOLDOWN_SECONDS = 60;

/** 密码最短长度。需求底稿未定义规则，与后端对齐前取常见下限，双端一致前只做本地校验。 */
const PASSWORD_MIN_LENGTH = 8;

type AuthMode = 'email' | 'password' | 'register';

export type AuthFormProps = {
  onAuthenticated: () => void;
};

/**
 * C 端账户主入口，三种形态（需求底稿 18.4/18.5，2026-08-05 恢复密码体系）：
 * - 邮箱验证码：登录注册二合一，后端已上线，仍是默认路径——存量用户没有可用密码
 *   （建号时被设为随机 UUID），验证码是他们唯一登得进来的方式，不可移除；
 * - 邮箱密码登录 + 注册：底稿口径。后端接口未落地前 api 数据源显式报
 *   CONTRACT_UNAVAILABLE，mock 数据源完整可用；
 * - Google 授权：不变。
 * 「忘记密码」走独立路由页（存量用户借它设置首个可用密码），管理员的
 * password-login 与本表单无关，不在 C 端暴露。
 */
export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const { t } = useTranslation();
  const closeLogin = useLoginModal((state) => state.closeLogin);

  const [mode, setMode] = useState<AuthMode>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const emailCodeLogin = useEmailCodeLogin();
  const sendEmailCode = useSendEmailCode();
  const passwordLogin = usePasswordLogin();
  const register = useRegister();
  const googleLogin = useGoogleLogin();

  /**
   * 未配 client id 时 GoogleLoginButton 会降级成演示按钮，发的是假凭据
   * 'mock-google-credential'——对 mock 数据源是有用的本地通路，对真实后端却必然失败。
   * 2026-08-06 行业发现线上就是这么坏的：部署漏配 VITE_GOOGLE_CLIENT_ID（Dockerfile 的
   * ARG 默认空串），产物静默降级，用户点完只拿到一句「Google ID token 无效」。
   * 这种组合下宁可不给入口，也好过给一个必坏的按钮。
   */
  const isGoogleLoginAvailable =
    Boolean(runtimeConfig.googleClientId) || runtimeConfig.dataSource !== 'api';

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  const isBusy =
    emailCodeLogin.isPending ||
    sendEmailCode.isPending ||
    passwordLogin.isPending ||
    register.isPending ||
    googleLogin.isPending;

  const activeError =
    emailCodeLogin.error ??
    passwordLogin.error ??
    register.error ??
    googleLogin.error ??
    sendEmailCode.error ??
    null;

  // 本地校验（长度/两次不一致/未勾协议）优先展示；服务端错误按错误码映射文案。
  let errorText: string | null = localError;
  if (!errorText && activeError) {
    if (isAuthError(activeError) && activeError.code !== 'generic') {
      errorText = t(`auth.errors.${activeError.code}`);
    } else if (isAuthError(activeError) && activeError.serverMessage) {
      errorText = getApiErrorMessage(activeError);
    } else {
      errorText = t('auth.errors.generic');
    }
  }

  let sendCodeLabel = t('auth.email.sendCode');
  if (sendEmailCode.isPending) {
    sendCodeLabel = t('auth.email.sending');
  } else if (cooldown > 0) {
    sendCodeLabel = t('auth.email.resend', { seconds: cooldown });
  }

  function clearVisibleErrors() {
    setLocalError(null);
    if (emailCodeLogin.error) {
      emailCodeLogin.reset();
    }
    if (passwordLogin.error) {
      passwordLogin.reset();
    }
    if (register.error) {
      register.reset();
    }
    if (googleLogin.error) {
      googleLogin.reset();
    }
    if (sendEmailCode.error) {
      sendEmailCode.reset();
    }
  }

  function handleTextChange(setValue: (value: string) => void, value: string) {
    clearVisibleErrors();
    setValue(value);
  }

  /** 切模式时清掉本地及 mutation 错误与密码可见性；邮箱保留，来回切换不用重填。 */
  function switchMode(next: AuthMode) {
    setMode(next);
    clearVisibleErrors();
    setIsPasswordVisible(false);
  }

  function handleSendCode() {
    if (isBusy || cooldown > 0 || !email.trim()) {
      return;
    }
    sendEmailCode.mutate(
      // 注册与登录共用发码接口，场景不同；后端把 REGISTER 归一化到与登录同池
      { email: email.trim(), scene: mode === 'register' ? 'REGISTER' : 'LOGIN' },
      { onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS) },
    );
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    emailCodeLogin.mutate(
      { email: email.trim(), code: code.trim() },
      { onSuccess: onAuthenticated },
    );
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    setLocalError(null);
    passwordLogin.mutate({ email: email.trim(), password }, { onSuccess: onAuthenticated });
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    // 本地校验先于提交：格式问题不值得跑一次网络往返。
    if (password.length < PASSWORD_MIN_LENGTH) {
      setLocalError(t('auth.errors.PASSWORD_TOO_SHORT', { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (password !== confirmPassword) {
      setLocalError(t('auth.errors.PASSWORD_MISMATCH'));
      return;
    }
    if (!agreed) {
      setLocalError(t('auth.errors.AGREEMENT_REQUIRED'));
      return;
    }
    setLocalError(null);
    // 需求底稿 18.4：注册成功自动登录，走同一个 onAuthenticated 收尾。
    register.mutate(
      { email: email.trim(), code: code.trim(), password },
      { onSuccess: onAuthenticated },
    );
  }

  const passwordToggle = (
    <button
      type="button"
      className={styles.passwordToggle}
      aria-label={t(isPasswordVisible ? 'auth.password.hide' : 'auth.password.show')}
      aria-pressed={isPasswordVisible}
      onClick={() => setIsPasswordVisible((visible) => !visible)}
    >
      {isPasswordVisible ? (
        <EyeOff size={19} aria-hidden="true" />
      ) : (
        <Eye size={19} aria-hidden="true" />
      )}
    </button>
  );

  const emailField = (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="auth-email">
        {t('auth.email.label')}
      </label>
      <div className={styles.inputShell}>
        <Mail className={styles.inputIcon} size={18} aria-hidden="true" />
        <input
          id="auth-email"
          className={styles.input}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => handleTextChange(setEmail, event.target.value)}
          placeholder={t('auth.email.placeholder')}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      {mode !== 'register' ? (
        <div className={styles.modeSwitch} role="group" aria-label={t('auth.title')}>
          <button
            type="button"
            className={styles.modeButton}
            data-active={mode === 'email'}
            aria-pressed={mode === 'email'}
            onClick={() => switchMode('email')}
          >
            {t('auth.tabs.email')}
          </button>
          <button
            type="button"
            className={styles.modeButton}
            data-active={mode === 'password'}
            aria-pressed={mode === 'password'}
            onClick={() => switchMode('password')}
          >
            {t('auth.tabs.password')}
          </button>
        </div>
      ) : null}

      {mode === 'email' ? (
        <form className={styles.form} onSubmit={handleEmailSubmit} noValidate>
          {emailField}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-code">
              {t('auth.email.codeLabel')}
            </label>
            <div className={styles.codeRow}>
              <div className={styles.inputShell}>
                <KeyRound className={styles.inputIcon} size={18} aria-hidden="true" />
                <input
                  id="auth-code"
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => handleTextChange(setCode, event.target.value)}
                  placeholder={t('auth.email.codePlaceholder')}
                />
              </div>
              <button
                type="button"
                className={styles.codeButton}
                onClick={handleSendCode}
                disabled={isBusy || cooldown > 0 || !email.trim()}
              >
                {sendCodeLabel}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={isBusy || !email.trim() || !code.trim()}
          >
            {emailCodeLogin.isPending ? t('auth.loading') : t('auth.email.submit')}
          </button>
        </form>
      ) : null}

      {mode === 'password' ? (
        <form className={styles.form} onSubmit={handlePasswordSubmit} noValidate>
          {emailField}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-password">
              {t('auth.password.label')}
            </label>
            <div className={styles.inputShell}>
              <LockKeyhole className={styles.inputIcon} size={18} aria-hidden="true" />
              <input
                id="auth-password"
                className={`${styles.input} ${styles.passwordInput}`}
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => handleTextChange(setPassword, event.target.value)}
                placeholder={t('auth.password.placeholder')}
              />
              {passwordToggle}
            </div>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={isBusy || !email.trim() || !password}
          >
            {passwordLogin.isPending ? t('auth.loading') : t('auth.password.submit')}
          </button>
        </form>
      ) : null}

      {mode === 'register' ? (
        <form className={styles.form} onSubmit={handleRegisterSubmit} noValidate>
          {emailField}

          {/* 邮箱验证（2026-08-05 拍板）：没有收件箱控制权就不能替这个邮箱建号 */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-code">
              {t('auth.email.codeLabel')}
            </label>
            <div className={styles.codeRow}>
              <div className={styles.inputShell}>
                <KeyRound className={styles.inputIcon} size={18} aria-hidden="true" />
                <input
                  id="auth-code"
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => handleTextChange(setCode, event.target.value)}
                  placeholder={t('auth.email.codePlaceholder')}
                />
              </div>
              <button
                type="button"
                className={styles.codeButton}
                onClick={handleSendCode}
                disabled={isBusy || cooldown > 0 || !email.trim()}
              >
                {sendCodeLabel}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-password">
              {t('auth.register.passwordLabel')}
            </label>
            <div className={styles.inputShell}>
              <LockKeyhole className={styles.inputIcon} size={18} aria-hidden="true" />
              <input
                id="auth-password"
                className={`${styles.input} ${styles.passwordInput}`}
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => handleTextChange(setPassword, event.target.value)}
                placeholder={t('auth.register.passwordPlaceholder', { min: PASSWORD_MIN_LENGTH })}
              />
              {passwordToggle}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-confirm-password">
              {t('auth.register.confirmLabel')}
            </label>
            <div className={styles.inputShell}>
              <LockKeyhole className={styles.inputIcon} size={18} aria-hidden="true" />
              <input
                id="auth-confirm-password"
                className={styles.input}
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => handleTextChange(setConfirmPassword, event.target.value)}
                placeholder={t('auth.register.confirmPlaceholder')}
              />
            </div>
          </div>

          <label className={styles.agreement}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => {
                clearVisibleErrors();
                setAgreed(event.target.checked);
              }}
            />
            <span>
              {t('auth.register.agreementPrefix')}
              {/* 新开标签查看协议，不打断填写；stopPropagation 防止点链接顺带切换勾选 */}
              <a
                className={styles.agreementLink}
                href="/terms"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {t('auth.register.agreementLink')}
              </a>
            </span>
          </label>

          <button
            type="submit"
            className={styles.submit}
            disabled={isBusy || !email.trim() || !code.trim() || !password || !confirmPassword}
          >
            {register.isPending ? t('auth.loading') : t('auth.register.submit')}
          </button>
        </form>
      ) : null}

      {errorText ? (
        <p className={styles.error} role="alert">
          {errorText}
        </p>
      ) : null}

      {isGoogleLoginAvailable ? (
        <GoogleLoginButton
          disabled={isBusy}
          onAuth={(payload: GoogleLoginInput) => {
            if (!isBusy) {
              googleLogin.mutate(payload, { onSuccess: onAuthenticated });
            }
          }}
        />
      ) : null}

      {/* 次级入口统一排在 Google 之下：密码模式一行两个，验证码模式只有注册入口。 */}
      {mode === 'password' ? (
        <div className={styles.linkRow}>
          {/* 关掉弹窗再走路由：找回密码是独立页面（存量用户设置首个可用密码的入口）。 */}
          <Link className={styles.inlineLink} to="/forgot-password" onClick={closeLogin}>
            {t('auth.password.forgot')}
          </Link>
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => switchMode('register')}
          >
            {t('auth.register.entry')}
          </button>
        </div>
      ) : null}
      {mode === 'email' ? (
        <button type="button" className={styles.inlineLink} onClick={() => switchMode('register')}>
          {t('auth.register.entry')}
        </button>
      ) : null}
      {mode === 'register' ? (
        <button type="button" className={styles.inlineLink} onClick={() => switchMode('email')}>
          {t('auth.register.back')}
        </button>
      ) : null}
    </div>
  );
}
