import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { authCapabilities } from '../../model/auth.capabilities';
import { KeyRound, LockKeyhole, Mail, User } from '../../../../shared/icons';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/shared/utils/cn';
import { resolveAuthErrorText } from '../../model/auth.error-text';
import {
  useEmailCodeLogin,
  useGoogleLogin,
  usePasswordLogin,
  useRegister,
  useResetPassword,
  useSendEmailCode,
} from '../../model/auth.mutations';
import { useAuthStore } from '../../model/auth.store';
import type { AuthSession, EmailCodeScene, GoogleLoginInput } from '../../model/auth.types';
import {
  validateEmail,
  validateEmailCode,
  validateNewPassword,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
} from '../../model/auth.validation';
import { AuthField } from '../AuthField';
import { GoogleLoginButton } from '../GoogleLoginButton';

/**
 * 四种形态。前两个是登录方式，用 tab 平级切换；后两个是从登录派生出的独立流程，
 * 各自占满表单区并提供返回入口。
 */
type Mode = 'code' | 'password' | 'register' | 'forgot';

/**
 * 本地校验错误挂到所属字段下方（AuthField 的 error 槽）。注册态五个字段一摞，
 * 「邮箱不对」的提示若落在表单末尾的公共槽里，离邮箱框隔着三个字段，
 * 用户得自己找是哪一格错了。请求级错误（后端拒绝）仍走末尾公共槽——
 * 它们大多不属于某一个字段。
 */
type ErrorField = 'username' | 'email' | 'code' | 'password' | 'confirm';

const LOGIN_MODES: ReadonlyArray<'code' | 'password'> = authCapabilities.emailCode
  ? ['code', 'password'] : ['password'];
const DEFAULT_MODE = LOGIN_MODES[0];

/**
 * 配了 client id 就渲染真实 Google 按钮；没配但在 mock 数据源下渲染演示按钮，
 * 保证本地流程可走通。走 api 数据源又没配 client id 时整块隐藏——那种情况下
 * 点了必然失败，不如不给。
 */
const CAN_USE_GOOGLE = authCapabilities.google;

export type AuthFormProps = {
  /** 登录成功、会话已写入 store 之后调用；跳转由调用方决定。 */
  onAuthenticated: (session: AuthSession) => void;
  /** 由弹窗 owner 控制不同屏幕下的内容节奏，不改变认证流程。 */
  className?: string;
};

/** Standard template form; available modes follow the actual backend capabilities. */
export function AuthForm({ onAuthenticated, className }: AuthFormProps) {
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  /** 验证码发给了哪个邮箱（小写）。改邮箱即回到未发送态：旧码对新地址无效。 */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentScene, setSentScene] = useState<EmailCodeScene | null>(null);
  const [expireSeconds, setExpireSeconds] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [formError, setFormError] = useState<{ field: ErrorField; text: string } | null>(null);
  const [firstLogin, setFirstLogin] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 「记住我」在 store 里而不是组件本地 state：它决定会话落 localStorage
  // 还是 sessionStorage，持久化层要能读到同一份真相。
  const remember = useAuthStore((state) => state.remember);
  const setRemember = useAuthStore((state) => state.setRemember);

  const sendCode = useSendEmailCode();
  const codeLogin = useEmailCodeLogin();
  const passwordLogin = usePasswordLogin();
  const register = useRegister();
  const resetPassword = useResetPassword();
  const googleLogin = useGoogleLogin();

  // 发码场景随形态走：只有找回密码用 reset_password（后端据此只发给已注册邮箱）。
  const scene: EmailCodeScene = mode === 'forgot' ? 'reset_password' : 'login_register';
  const codeSent = sentTo !== null && sentTo === email.trim().toLowerCase() && sentScene === scene;
  const ticking = cooldown > 0;
  // 冷却只约束「再发一次给同一个地址」。改了收件邮箱还锁着按钮，
  // 等于把打错字的人罚站一分钟。
  const cooling = codeSent && ticking;

  useEffect(() => {
    if (!ticking) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  // 末尾公共槽只展示请求级错误；本地校验错误由 fieldError 落到各自字段下。
  const requestError =
    sendCode.error ??
    codeLogin.error ??
    passwordLogin.error ??
    register.error ??
    resetPassword.error ??
    null;
  const message = resolveAuthErrorText(requestError, t);
  const googleMessage = resolveAuthErrorText(googleLogin.error, t);

  const fieldError = (field: ErrorField) =>
    formError?.field === field ? formError.text : undefined;

  /** 校验失败：错误码翻成文案，挂到指定字段。 */
  function failField(field: ErrorField, errorCode: string) {
    setFormError({ field, text: t(`auth.errors.${errorCode}`) });
  }

  // 后端给的是秒；向上取整到分钟，600 秒说成「10 分钟」比「600 秒」好读。
  const expireMinutes = Math.max(1, Math.ceil(expireSeconds / 60));

  /** 清掉上一形态残留的错误与请求态，否则旧提示会盖在新表单上。 */
  function resetFeedback() {
    setFormError(null);
    setFirstLogin(false);
    setResetDone(false);
    sendCode.reset();
    codeLogin.reset();
    passwordLogin.reset();
    register.reset();
    resetPassword.reset();
  }

  /**
   * 切形态时密码类字段一律清空——「登录密码」与「要设置的新密码」语义不同，
   * 留着上一态的输入只会让人误提交。邮箱保留：四条链路都用它，来回切不用重填。
   */
  function switchMode(next: Mode) {
    resetFeedback();
    setPassword('');
    setConfirmPassword('');
    if ((mode === 'forgot') !== (next === 'forgot')) setCode('');
    setMode(next);
  }

  function sendLabel() {
    if (sendCode.isPending) {
      return t('auth.submitting');
    }
    if (cooling) {
      return t('auth.resendIn', { seconds: cooldown });
    }
    return t(codeSent ? 'auth.resendCode' : 'auth.sendCode');
  }

  function handleSendCode() {
    resetFeedback();

    // 本地校验先于提交：格式问题不值得跑一次网络往返。
    const emailError = validateEmail(email);
    if (emailError) {
      failField('email', emailError);
      return;
    }

    const target = email.trim();
    sendCode.mutate(
      { email: target, scene },
      {
        onSuccess: (result) => {
          setSentTo(target.toLowerCase());
          setSentScene(scene);
          setCooldown(result.cooldownSeconds);
          setExpireSeconds(result.expireSeconds);
        },
      },
    );
  }

  function handleCodeLogin() {
    resetFeedback();

    // 邮箱也要校验。旧布局下这里可以省——码框发完才出现，能提交就说明邮箱已过
    // validateEmail 且逐字未变。码框常驻后这个前提没了：填个不合法邮箱配六位数字
    // 就能提交，不挡住的话会白跑一次网络往返。
    const emailProblem = validateEmail(email);
    if (emailProblem) {
      failField('email', emailProblem);
      return;
    }
    const codeProblem = validateEmailCode(code);
    if (codeProblem) {
      failField('code', codeProblem);
      return;
    }

    codeLogin.mutate(
      { email: email.trim(), code: code.trim() },
      {
        onSuccess: (session) => {
          // 首次验证码登录顺带把账号注册了，值得单独说一句。
          setFirstLogin(session.newUser);
          onAuthenticated(session);
        },
      },
    );
  }

  /**
   * 提交只做登录。原先是「还没发码就发码，发过了才提交」——那套分支依赖旧布局里
   * 「码框发完才出现」的前提，用户不可能提前提交。改成码框常驻后前提没了：填了码
   * 直接回车会变成再发一次验证码，而不是登录。发码有自己的按钮，这里不抢它的活。
   */
  function handleCodeFormSubmit(event: FormEvent) {
    event.preventDefault();
    handleCodeLogin();
  }

  function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (passwordLogin.isPending) return;
    resetFeedback();

    const usernameProblem = validateUsername(username);
    if (usernameProblem) {
      failField('username', usernameProblem);
      return;
    }
    const passwordProblem = validatePassword(password);
    if (passwordProblem) {
      failField('password', passwordProblem);
      return;
    }

    passwordLogin.mutate(
      { username, password },
      // 显式只把 session 交出去。直接传 onAuthenticated 的话，TanStack Query
      // 会用 (data, variables, context) 三个参数调它，与验证码那条路径不一致。
      { onSuccess: (session) => onAuthenticated(session) },
    );
  }

  /** 注册（契约 §1.7）。本地校验顺序与后端一致，先挡住不值得走网络的那几种。 */
  function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    if (register.isPending) return;
    resetFeedback();

    const checks: Array<[ErrorField, string | null]> = [
      ['username', validateUsername(username)],
      ['email', authCapabilities.emailCode ? validateEmail(email) : null],
      ['code', authCapabilities.emailCode ? validateEmailCode(code) : null],
      ['password', validateNewPassword(password)],
      ['confirm', validatePasswordConfirmation(password, confirmPassword)],
    ];
    const firstProblem = checks.find(([, problem]) => problem !== null);
    if (firstProblem && firstProblem[1]) {
      failField(firstProblem[0], firstProblem[1]);
      return;
    }

    register.mutate(
      { username, email: email.trim(), password, code: code.trim() },
      { onSuccess: (session) => onAuthenticated(session) },
    );
  }

  /**
   * 重置密码（契约 §1.10）。成功不签发会话，所以不调 onAuthenticated——
   * 回到密码登录形态并留一句提示，让用户拿新密码进来。
   */
  function handleForgotSubmit(event: FormEvent) {
    event.preventDefault();
    if (resetPassword.isPending) return;
    resetFeedback();

    const checks: Array<[ErrorField, string | null]> = [
      ['email', validateEmail(email)],
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
      { email: email.trim(), code: code.trim(), newPassword: password },
      {
        onSuccess: () => {
          setPassword('');
          setConfirmPassword('');
          setCode('');
          setMode('password');
          setResetDone(true);
        },
      },
    );
  }

  /** 两条链路各产出一种凭据（credential / code），原样交给后端按形态分支。 */
  function handleGoogleAuth(payload: GoogleLoginInput) {
    setFormError(null);
    googleLogin.mutate(payload, { onSuccess: (session) => onAuthenticated(session) });
  }

  const rememberCheckbox = (
    <label className="inline-flex items-center gap-[var(--space-2)] text-[var(--font-size-md)] leading-[var(--line-height-md)] text-foreground">
      <input
        type="checkbox"
        checked={remember}
        className="size-[var(--icon-size-md)] accent-primary focus-visible:[--tw-ring-width:var(--focus-ring-width)] focus-visible:ring-ring focus-visible:ring-offset-background"
        onChange={(event) => setRemember(event.target.checked)}
      />
      <span>{t('auth.remember')}</span>
    </label>
  );

  const emailField = (
    <AuthField
      id="auth-email"
      type="email"
      label={t('auth.email')}
      value={email}
      onChange={setEmail}
      error={fieldError('email')}
      placeholder={t('auth.emailPlaceholder')}
      autoComplete="email"
      icon={Mail}
    />
  );

  /** 验证码块由登录、注册和找回密码三条链路共用。 */
  const emailCodeBlock = (
    <>
      <AuthField
        id="auth-code"
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
            size="default"
            onClick={handleSendCode}
            disabled={sendCode.isPending || cooling}
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
            {t('auth.codeSent', { email: sentTo })}
          </p>
          <p className="text-[var(--font-size-xs)] leading-[var(--line-height-sm)] text-muted-foreground">
            {t('auth.codeExpiresIn', { minutes: expireMinutes })}
          </p>
        </div>
      ) : null}
    </>
  );

  const feedback = (
    <>
      {message ? (
        <p
          className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-destructive"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {firstLogin ? (
        <p
          className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-success"
          role="status"
        >
          {t('auth.welcomeNew')}
        </p>
      ) : null}

      {resetDone ? (
        <p
          className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-success"
          role="status"
        >
          {t('auth.forgot.done')}
        </p>
      ) : null}
    </>
  );

  /** 登录方式之间是平级关系，用 tab 表达；注册与找回是派生流程，不进 tab。 */
  const tabs = (
    // 弹窗顶部为关闭按钮保留独立的 Header 空间，切换按钮保持完整宽度。
    <div className="pt-[var(--space-6)]">
      <Tabs
        value={mode === 'code' || mode === 'password' ? mode : 'code'}
        onValueChange={(value) => {
          if (value === 'code' || value === 'password') switchMode(value);
        }}
      >
        <TabsList className="w-full" aria-label={t('auth.login')}>
          {LOGIN_MODES.map((value) => (
            <TabsTrigger key={value} value={value} className="min-w-0 flex-1">
              {t(`auth.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );

  // Google 是「另一种进来的方式」，对找回密码这种修复流程没有意义，那一态不出现。
  const googleBlock =
    CAN_USE_GOOGLE && mode !== 'forgot' ? (
      <>
        <div className="flex items-center gap-[var(--space-3)] text-[var(--font-size-xs)] text-muted-foreground">
          <span className="h-[var(--control-border-width)] flex-1 bg-border" />
          <span>{t('auth.or')}</span>
          <span className="h-[var(--control-border-width)] flex-1 bg-border" />
        </div>

        <GoogleLoginButton disabled={googleLogin.isPending} onAuth={handleGoogleAuth} />

        {googleMessage ? (
          <p
            className="text-[var(--font-size-md)] leading-[var(--line-height-base)] text-destructive"
            role="alert"
          >
            {googleMessage}
          </p>
        ) : null}
      </>
    ) : null;

  /** 次级入口。派生流程只留返回，登录形态才给出口。 */
  const links = (
    <div
      className={cn(
        'flex flex-wrap gap-[var(--space-3)]',
        mode === 'password' ? 'w-full items-center justify-between' : 'justify-center',
      )}
    >
      {mode === 'password' && authCapabilities.passwordReset ? (
        <Button type="button" variant="link" size="sm" onClick={() => switchMode('forgot')}>
          {t('auth.forgot.entry')}
        </Button>
      ) : null}

      {mode === 'code' || mode === 'password' ? (
        <Button type="button" variant="link" size="sm" onClick={() => switchMode('register')}>
          {t('auth.register.entry')}
        </Button>
      ) : null}

      {mode === 'register' || mode === 'forgot' ? (
        <Button type="button" variant="link" size="sm" onClick={() => switchMode(DEFAULT_MODE)}>
          {t(`auth.${mode}.back`)}
        </Button>
      ) : null}
    </div>
  );

  function renderForm() {
    if (mode === 'password') {
      return (
        <form
          className="flex flex-col gap-[var(--form-group-gap)]"
          onSubmit={handlePasswordSubmit}
          noValidate
        >
          <AuthField
            id="auth-username"
            type="text"
            label={t('auth.username')}
            value={username}
            onChange={setUsername}
            error={fieldError('username')}
            placeholder={t('auth.usernamePlaceholder')}
            autoComplete="username"
            icon={User}
          />

          <AuthField
            id="auth-password"
            type="password"
            label={t('auth.password')}
            value={password}
            onChange={setPassword}
            error={fieldError('password')}
            placeholder={t('auth.passwordPlaceholder')}
            autoComplete="current-password"
            icon={LockKeyhole}
            showPasswordLabel={t('auth.showPassword')}
            hidePasswordLabel={t('auth.hidePassword')}
          />

          {rememberCheckbox}
          {feedback}

          <Button
            type="submit"
            loading={passwordLogin.isPending}
            disabled={!username.trim() || !password}
          >
            {t('auth.login')}
          </Button>
        </form>
      );
    }

    if (mode === 'register') {
      return (
        <form
          className="flex flex-col gap-[var(--form-group-gap)]"
          onSubmit={handleRegisterSubmit}
          noValidate
        >
          <AuthField
            id="auth-username"
            type="text"
            label={t('auth.username')}
            value={username}
            onChange={setUsername}
            error={fieldError('username')}
            placeholder={t('auth.register.usernamePlaceholder')}
            autoComplete="username"
            icon={User}
          />

          {authCapabilities.emailCode ? emailField : null}
          {authCapabilities.emailCode ? emailCodeBlock : null}

          <AuthField
            id="auth-new-password"
            type="password"
            label={t('auth.register.passwordLabel')}
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
            id="auth-confirm-password"
            type="password"
            label={t('auth.register.confirmLabel')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldError('confirm')}
            placeholder={t('auth.register.confirmPlaceholder')}
            autoComplete="new-password"
            icon={LockKeyhole}
          />

          {feedback}

          <Button
            type="submit"
            loading={register.isPending}
            disabled={
              !username.trim() || (authCapabilities.emailCode && (!email.trim() || !code.trim())) || !password || !confirmPassword
            }
          >
            {t('auth.register.submit')}
          </Button>
        </form>
      );
    }

    if (mode === 'forgot') {
      return (
        <form
          className="flex flex-col gap-[var(--form-group-gap)]"
          onSubmit={handleForgotSubmit}
          noValidate
        >
          <p className="text-[var(--font-size-sm)] leading-[var(--line-height-sm)] text-muted-foreground">
            {t('auth.forgot.hint')}
          </p>

          {emailField}
          {emailCodeBlock}

          <AuthField
            id="auth-new-password"
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
            id="auth-confirm-password"
            type="password"
            label={t('auth.register.confirmLabel')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldError('confirm')}
            placeholder={t('auth.register.confirmPlaceholder')}
            autoComplete="new-password"
            icon={LockKeyhole}
          />

          {feedback}

          <Button
            type="submit"
            loading={resetPassword.isPending}
            disabled={!email.trim() || !code.trim() || !password || !confirmPassword}
          >
            {t('auth.forgot.submit')}
          </Button>
        </form>
      );
    }

    return (
      <form
        className="flex flex-col gap-[var(--form-group-gap)]"
        onSubmit={handleCodeFormSubmit}
        noValidate
      >
        {emailField}
        {emailCodeBlock}
        {rememberCheckbox}
        {feedback}

        {/* 提交按钮常驻并按填写完整度禁用，不再等发码后才出现：
            验证码框已经常驻了，再让按钮凭空冒出来反而更跳。 */}
        <Button
          type="submit"
          loading={codeLogin.isPending}
          disabled={!email.trim() || !code.trim()}
        >
          {t('auth.login')}
        </Button>
      </form>
    );
  }

  return (
    <div className={cn('flex flex-col gap-[var(--content-gap)]', className)}>
      {mode === 'code' || mode === 'password' ? tabs : null}
      {renderForm()}
      {googleBlock}
      {links}
    </div>
  );
}
