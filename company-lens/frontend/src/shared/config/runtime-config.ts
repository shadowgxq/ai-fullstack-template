export const DEFAULT_API_TIMEOUT_MS = 10000;
export const DEFAULT_API_BASE_URL = '/api';

/** 数据源：mock（本地假数据）或 api（真实 product-service）。 */
export type DataSource = 'mock' | 'api';

/**
 * Google 登录链路：
 * - `code`：OAuth 授权码流，按钮我方自绘，请求体发 `{ code }`，后端拿 code 换 token；
 * - `idtoken`：GIS ID token 流，按钮由 Google 在跨域 iframe 内渲染，请求体发 `{ credential }`。
 */
export type GoogleAuthMode = 'code' | 'idtoken';

/**
 * 缺省走 idtoken 是失败安全方向：`.env.*` 不进 git，生产的构建变量得在部署侧单独配；
 * 若默认 code，任何漏配的部署都会让 Google 登录直接挂（后端可能还没配 client-secret）。
 * 反过来默认 idtoken，最坏情况只是自绘按钮没生效，登录始终可用。
 */
const DEFAULT_GOOGLE_AUTH_MODE: GoogleAuthMode = 'idtoken';

/**
 * 缺省走真实服务：漏配或配错时宁可请求失败报错，也不要静默回落 mock——
 * 假数据会让登录"成功"、历史列表长出假记录，上线后没有任何可见异常。
 * 本地想用假数据，在 `.env.local` 显式写 `VITE_DATA_SOURCE=mock`。
 */
const DEFAULT_DATA_SOURCE: DataSource = 'api';
const DEFAULT_RESEARCH_DATA_SOURCE: DataSource = 'api';

type RuntimeEnv = {
  VITE_API_BASE_URL?: string;
  VITE_API_TIMEOUT_MS?: string;
  VITE_DATA_SOURCE?: string;
  VITE_RESEARCH_DATA_SOURCE?: string;
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_GOOGLE_AUTH_MODE?: string;
};

export type RuntimeConfig = Readonly<{
  api: Readonly<{
    baseUrl: string;
    timeoutMs: number;
  }>;
  dataSource: DataSource;
  researchDataSource: DataSource;
  /** Google Identity Services 的 OAuth Client ID（公开标识，非密钥）；缺省时不渲染真实 Google 登录。 */
  googleClientId?: string;
  googleAuthMode: GoogleAuthMode;
}>;

function readOptionalString(value: string | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue || undefined;
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function readDataSource(value: string | undefined, fallback = DEFAULT_DATA_SOURCE): DataSource {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === 'api' || normalizedValue === 'mock' ? normalizedValue : fallback;
}

function readGoogleAuthMode(value: string | undefined): GoogleAuthMode {
  return value?.trim().toLowerCase() === 'code' ? 'code' : DEFAULT_GOOGLE_AUTH_MODE;
}

export function createRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  return Object.freeze({
    api: Object.freeze({
      baseUrl: readOptionalString(env.VITE_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
      timeoutMs: readPositiveNumber(env.VITE_API_TIMEOUT_MS, DEFAULT_API_TIMEOUT_MS),
    }),
    dataSource: readDataSource(env.VITE_DATA_SOURCE),
    researchDataSource: readDataSource(env.VITE_RESEARCH_DATA_SOURCE, DEFAULT_RESEARCH_DATA_SOURCE),
    googleClientId: readOptionalString(env.VITE_GOOGLE_CLIENT_ID),
    googleAuthMode: readGoogleAuthMode(env.VITE_GOOGLE_AUTH_MODE),
  });
}

export const runtimeConfig = createRuntimeConfig(import.meta.env);
