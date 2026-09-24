/** Google Identity Services 里本项目使用的授权码流最小类型声明。 */
type GoogleCodeResponse = {
  code?: string;
  /** 用户关闭弹窗、拒绝授权等；成功时不出现。 */
  error?: string;
  error_description?: string;
};

type GoogleCodeClient = {
  requestCode: () => void;
};

type GoogleCodeClientConfig = {
  client_id: string;
  scope: string;
  /** popup + callback 形态下 redirect_uri 隐式为 `postmessage`。 */
  ux_mode?: 'popup' | 'redirect';
  callback: (response: GoogleCodeResponse) => void;
  /** 弹窗关闭 / 初始化失败；旧版 GIS 没有此回调，故为可选。 */
  error_callback?: (error: { type?: string; message?: string }) => void;
};

interface Window {
  google?: {
    accounts?: {
      oauth2?: {
        initCodeClient: (config: GoogleCodeClientConfig) => GoogleCodeClient;
      };
    };
  };
}
