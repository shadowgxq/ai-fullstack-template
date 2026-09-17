import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { runtimeConfig } from '../../../../shared/config';
import type { GoogleLoginInput } from '../../model/auth.types';
import styles from './GoogleLoginButton.module.css';

const GIS_SCRIPT_ID = 'google-identity-services';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** 授权码流申请的权限范围：只要能识别用户身份，够拿到 id_token 里的 sub/email 即可。 */
const GOOGLE_OAUTH_SCOPE = 'openid email profile';

/**
 * 应用语言 → GIS locale。按钮文案由 GIS 在跨域 iframe 内渲染，本地 i18n 够不着，
 * 只能靠这个参数指定；不传的话 GIS 会读 Google 账号的语言偏好，于是英文界面里
 * 会冒出「以某某的身份继续」。GIS 认下划线变体，简中要 zh_CN 而不是 zh。
 * 只有 idtoken 一路需要它——code 一路的按钮是我方 DOM，直接走 i18n。
 */
const GIS_LOCALES: Record<string, string> = { en: 'en', zh: 'zh_CN' };
const DEFAULT_GIS_LOCALE = 'en';

export type GoogleLoginButtonProps = {
  disabled?: boolean;
  /** 两条链路各产出一种凭据，原样交给上层调 /account/google-login，后端按形态分支。 */
  onAuth: (payload: GoogleLoginInput) => void;
};

/** 官方四色 G。Google 品牌规范要求 logo 原样使用，不得改色或变形。 */
function GoogleGlyph() {
  return (
    <svg
      className={styles.googleIcon}
      aria-hidden="true"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48Z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72l2.84 2.2c1.66-1.53 2.76-3.79 2.76-6.56Z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.44 15.98 5.48 18 9 18Z"
      />
    </svg>
  );
}

/**
 * Google 登录按钮，两条链路由 runtimeConfig.googleAuthMode 切换：
 * - `idtoken`（缺省）：注入 GIS SDK 渲染官方按钮，回调给出 ID token（credential）；
 *   按钮活在 Google 的跨域 iframe 里，配色只能在 GIS 给的三种里选。
 * - `code`：GIS 只给 `initCodeClient` 这个 JS API 不给按钮，UI 完全是我方 DOM，
 *   点击弹 Google 授权窗，回调给出授权码（code），由后端换 token。
 * 未配置 client id 时保留品牌按钮，点击就地提示配置错误，不生成假凭据。
 */
export function GoogleLoginButton({ disabled = false, onAuth }: GoogleLoginButtonProps) {
  const { t, i18n } = useTranslation();
  const clientId = runtimeConfig.googleClientId;
  const mode = runtimeConfig.googleAuthMode;
  const buttonRef = useRef<HTMLDivElement>(null);
  const renderedLocaleRef = useRef<string | null>(null);
  const codeClientRef = useRef<{ requestCode: () => void } | null>(null);
  const language = i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_GIS_LOCALE;
  const gisLocale = GIS_LOCALES[language.split('-')[0]] ?? DEFAULT_GIS_LOCALE;
  const [isScriptReady, setIsScriptReady] = useState(() => Boolean(window.google?.accounts));
  const [scriptError, setScriptError] = useState<string | null>(null);

  // 回调与译函数都走 ref：父组件每次渲染都会新建 onAuth（AuthForm 里就是普通函数声明），
  // 让下面的 effect 依赖它，验证码倒计时那种每秒一次的重渲就会连带重建按钮/重开 codeClient。
  // 用 ref 持有还顺带消掉了陈旧闭包——GIS 的 initialize 只在语言变化时重调一次，
  // 若把 onAuth 直接闭进去，它会一直停在首次渲染那一版。
  const onAuthRef = useRef(onAuth);
  const tRef = useRef(t);

  useEffect(() => {
    onAuthRef.current = onAuth;
    tRef.current = t;
  });

  const handleAuth = useCallback((payload: GoogleLoginInput) => {
    setScriptError(null);
    onAuthRef.current(payload);
  }, []);

  // 注入 GIS SDK（一次）。两条链路共用同一个 SDK。
  useEffect(() => {
    if (!clientId || isScriptReady) {
      return undefined;
    }

    const existingScript = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => {
      setIsScriptReady(true);
      setScriptError(null);
    };
    const handleError = () => {
      setScriptError(tRef.current('auth.googleErrors.scriptFailed'));
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existingScript) {
      script.id = GIS_SCRIPT_ID;
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, [clientId, isScriptReady]);

  // —— code 链路：只初始化 codeClient，按钮由下面的 JSX 自绘 ——
  useEffect(() => {
    if (mode !== 'code' || !clientId || !isScriptReady) {
      return;
    }

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      return;
    }

    codeClientRef.current = oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_OAUTH_SCOPE,
      ux_mode: 'popup',
      callback: (response) => {
        if (!response.code) {
          // 用户主动关掉授权窗时 Google 也会回调，这种不该报错打扰
          if (response.error && response.error !== 'access_denied') {
            setScriptError(
              response.error_description ?? tRef.current('auth.googleErrors.emptyCredential'),
            );
          }
          return;
        }
        handleAuth({ code: response.code });
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') {
          return;
        }
        setScriptError(error.message ?? tRef.current('auth.googleErrors.scriptFailed'));
      },
    });
  }, [clientId, handleAuth, isScriptReady, mode]);

  // —— idtoken 链路：初始化并渲染官方按钮，credential 上抛。切语言要重渲一次，
  // 否则按钮会一直停在首次渲染时的语言上（GIS 不接受事后改语言，只能重新画）。——
  useEffect(() => {
    if (mode !== 'idtoken') {
      return;
    }

    const googleIdentity = window.google?.accounts?.id;
    const buttonElement = buttonRef.current;
    if (!clientId || !isScriptReady || !googleIdentity || !buttonElement) {
      return;
    }
    if (renderedLocaleRef.current === gisLocale) {
      return;
    }

    googleIdentity.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response.credential) {
          setScriptError(tRef.current('auth.googleErrors.emptyCredential'));
          return;
        }
        handleAuth({ credential: response.credential });
      },
    });
    // renderButton 是追加语义：重渲前不清空会叠出两个按钮。
    buttonElement.replaceChildren();
    const width = Math.min(400, Math.max(240, Math.round(buttonElement.clientWidth) || 320));
    googleIdentity.renderButton(buttonElement, {
      type: 'standard',
      shape: 'pill',
      size: 'large',
      text: 'continue_with',
      theme: 'outline',
      logo_alignment: 'center',
      width,
      locale: gisLocale,
    });
    renderedLocaleRef.current = gisLocale;
  }, [clientId, gisLocale, handleAuth, isScriptReady, mode]);

  function handleCodeClick() {
    const codeClient = codeClientRef.current;
    if (!codeClient) {
      setScriptError(t('auth.googleErrors.scriptFailed'));
      return;
    }
    setScriptError(null);
    codeClient.requestCode();
  }

  // 未配置 client id：保留入口，但不加载 GIS 或发起登录请求。
  if (!clientId) {
    return (
      <div className={styles.root}>
        <button
          type="button"
          className={styles.brandButton}
          onClick={() => setScriptError(t('auth.googleErrors.missingClientId'))}
          disabled={disabled}
        >
          <img className={styles.googleIcon} src="/google-g.svg" alt="" />
          <span>{t('auth.google')}</span>
        </button>
        {scriptError ? (
          <p className={styles.error} role="alert">
            {scriptError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.root} data-disabled={disabled || undefined}>
      {mode === 'code' ? (
        <button
          type="button"
          className={styles.brandButton}
          onClick={handleCodeClick}
          disabled={disabled || !isScriptReady}
        >
          <GoogleGlyph />
          <span>{t('auth.google')}</span>
        </button>
      ) : (
        <div ref={buttonRef} className={styles.slot} />
      )}
      {scriptError ? (
        <p className={styles.error} role="alert">
          {scriptError}
        </p>
      ) : null}
    </div>
  );
}
