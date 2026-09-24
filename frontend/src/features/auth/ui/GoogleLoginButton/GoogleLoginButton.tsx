import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui/button';
import { runtimeConfig } from '../../../../shared/config';
import type { GoogleLoginInput } from '../../model/auth.types';

const GIS_SCRIPT_ID = 'google-identity-services';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** 后端 code 分支要从 token 端点拿回 id_token，openid 不能省。 */
const GIS_SCOPE = 'openid email profile';

export type GoogleLoginButtonProps = {
  disabled?: boolean;
  onAuth: (payload: GoogleLoginInput) => void;
};

/** SVG 不缩放：Google 品牌规范要求 logo 原样使用，官方四色是品牌资产例外。 */
function GoogleGlyph() {
  return (
    <svg
      className="size-[var(--icon-size-md)]"
      aria-hidden="true"
      viewBox="0 0 18 18"
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
 * Google 授权码（authorization code）流，对应后端 `{ code }` 分支：前端只拿到一次性
 * code，换 token 由后端带 client secret 完成，secret 不进浏览器。
 *
 * 不用 GIS 的 `renderButton`：官方按钮在跨域 iframe 中渲染，无法与应用表单共享尺寸
 * 和主题。授权码流没有对应的官方按钮渲染 API，因此按钮由应用使用 shadcn Button 自绘。
 * 这样配置真实 client id 和 mock 数据源时也能保持同一套视觉。
 */
export function GoogleLoginButton({ disabled = false, onAuth }: GoogleLoginButtonProps) {
  const { t } = useTranslation();
  const clientId = runtimeConfig.auth.googleClientId;
  const codeClientRef = useRef<GoogleCodeClient>();
  const onAuthRef = useRef(onAuth);
  const tRef = useRef(t);
  const [isScriptReady, setIsScriptReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2),
  );
  const [googleError, setGoogleError] = useState<string>();

  useEffect(() => {
    onAuthRef.current = onAuth;
    tRef.current = t;
  }, [onAuth, t]);

  useEffect(() => {
    if (!clientId || isScriptReady) return undefined;

    const existingScript = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    const handleLoad = () => {
      setIsScriptReady(true);
      setGoogleError(undefined);
    };
    const handleError = () => setGoogleError(tRef.current('auth.googleErrors.scriptFailed'));

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

  useEffect(() => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!clientId || !isScriptReady || !oauth2 || codeClientRef.current) return;

    codeClientRef.current = oauth2.initCodeClient({
      client_id: clientId,
      scope: GIS_SCOPE,
      // popup + callback 形态下 redirect_uri 隐式为 postmessage，与后端保持一致。
      ux_mode: 'popup',
      callback: (response) => {
        if (!response.code) {
          setGoogleError(tRef.current('auth.googleErrors.emptyCode'));
          return;
        }
        setGoogleError(undefined);
        onAuthRef.current({ code: response.code });
      },
      error_callback: () => {
        setGoogleError(tRef.current('auth.googleErrors.popupClosed'));
      },
    });
  }, [clientId, isScriptReady]);

  const handleClick = useCallback(() => {
    if (!clientId) {
      // mock 数据源下没有真实 client，给一个占位凭据把链路跑通。
      onAuthRef.current({ credential: 'mock-google-credential' });
      return;
    }
    setGoogleError(undefined);
    codeClientRef.current?.requestCode();
  }, [clientId]);

  // 脚本没就绪就禁用：此时 requestCode 还不存在，点击后无反馈比禁用更难解释。
  const isBusy = disabled || (Boolean(clientId) && !isScriptReady);

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleClick}
        disabled={isBusy}
      >
        <GoogleGlyph />
        <span>{t('auth.google')}</span>
      </Button>
      {googleError ? (
        <p
          className="m-0 text-center text-[var(--font-size-xs)] leading-[var(--line-height-sm)] text-destructive"
          role="alert"
        >
          {googleError}
        </p>
      ) : null}
    </div>
  );
}
