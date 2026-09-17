/** Google Identity Services（GIS）SDK 的最小类型声明，仅覆盖本组件用到的 API。 */

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdButtonOptions = {
  type?: 'standard' | 'icon';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  logo_alignment?: 'left' | 'center';
  width?: number;
  /** GIS 按钮文案语言（如 en / zh_CN）。不传则由 GIS 读 Google 账号语言偏好。 */
  locale?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (element: HTMLElement, options: GoogleIdButtonOptions) => void;
};

/** initCodeClient 的回调载荷：拿到授权码，或用户取消/出错时的错误描述。 */
type GoogleCodeResponse = {
  code?: string;
  error?: string;
  error_description?: string;
};

/** OAuth 2.0 授权码流：Google 只给 API 不给按钮，UI 完全由我方掌控。 */
type GoogleAccountsOauth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode?: 'popup' | 'redirect';
    callback: (response: GoogleCodeResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => { requestCode: () => void };
};

interface Window {
  google?: {
    accounts?: {
      id?: GoogleAccountsId;
      oauth2?: GoogleAccountsOauth2;
    };
  };
}
