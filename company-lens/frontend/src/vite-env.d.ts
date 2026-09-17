/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /**
   * Google 登录走哪条链路：
   * - `code`：OAuth 授权码流，按钮由我方自绘，请求体发 `{ code }`，
   *   要求后端 `{ code }` 分支已上线且配了 `app.account.google.client-secret`；
   * - 其它值/缺省：GIS ID token 流，按钮由 Google 在跨域 iframe 内渲染（配色只能三选一），
   *   请求体发 `{ credential }`。
   * 默认落在 idtoken 一侧是失败安全：`.env.*` 不进 git，漏配变量的部署最坏只是新 UI 不生效，
   * 而不是线上 Google 登录直接挂掉。
   */
  readonly VITE_GOOGLE_AUTH_MODE?: 'code' | 'idtoken';
  readonly VITE_RESEARCH_DATA_SOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
