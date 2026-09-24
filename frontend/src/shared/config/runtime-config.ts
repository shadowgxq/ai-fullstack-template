export const DEFAULT_API_BASE_URL = '/api';
export const DEFAULT_API_TIMEOUT_MS = 20000;
export const DEFAULT_TRANSLATION_API_BASE_URL = '/translation-api';
export const DEFAULT_TRANSLATION_TIMEOUT_MS = 20000;
export const AUTH_DATA_SOURCES = ['api', 'mock'] as const;
export type AuthDataSource = (typeof AUTH_DATA_SOURCES)[number];

type RuntimeEnv = {
  VITE_API_BASE_URL?: string;
  VITE_API_TIMEOUT_MS?: string;
  VITE_TRANSLATION_API_BASE_URL?: string;
  VITE_TRANSLATION_TIMEOUT_MS?: string;
  VITE_AUTH_DATA_SOURCE?: string;
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_UMAMI_SRC?: string;
  VITE_UMAMI_WEBSITE_ID?: string;
};

export type RuntimeConfig = Readonly<{
  api: Readonly<{
    baseUrl: string;
    timeoutMs: number;
  }>;
  translation: Readonly<{
    baseUrl: string;
    timeoutMs: number;
  }>;
  auth: Readonly<{
    dataSource: AuthDataSource;
    googleClientId?: string;
  }>;
  /**
   * 埋点。项目有固定生产域名时可以改用 Umami 的 data-domains 白名单隔离本地脏数据；
   * 没有域名（多数项目在联调期都没有）就靠这两个变量：任一为空整套静默——不插脚本、
   * 不上报。本地开发默认留空，隔离效果比域名白名单更硬。
   */
  analytics: Readonly<{
    umamiSrc?: string;
    umamiWebsiteId?: string;
    enabled: boolean;
  }>;
}>;

function readOptionalString(value: string | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue || undefined;
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function readAuthDataSource(value: string | undefined): AuthDataSource {
  return value?.trim().toLowerCase() === 'mock' ? 'mock' : 'api';
}

export function createRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  // 两个都配齐才算开启：只配一个就静默，不做「有 src 无 id 也插脚本」这种半开状态。
  const umamiSrc = readOptionalString(env.VITE_UMAMI_SRC);
  const umamiWebsiteId = readOptionalString(env.VITE_UMAMI_WEBSITE_ID);

  return Object.freeze({
    api: Object.freeze({
      baseUrl: readOptionalString(env.VITE_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
      timeoutMs: readPositiveNumber(env.VITE_API_TIMEOUT_MS, DEFAULT_API_TIMEOUT_MS),
    }),
    translation: Object.freeze({
      baseUrl:
        readOptionalString(env.VITE_TRANSLATION_API_BASE_URL) ?? DEFAULT_TRANSLATION_API_BASE_URL,
      timeoutMs: readPositiveNumber(
        env.VITE_TRANSLATION_TIMEOUT_MS,
        DEFAULT_TRANSLATION_TIMEOUT_MS,
      ),
    }),
    auth: Object.freeze({
      dataSource: readAuthDataSource(env.VITE_AUTH_DATA_SOURCE),
      googleClientId: readOptionalString(env.VITE_GOOGLE_CLIENT_ID),
    }),
    analytics: Object.freeze({
      umamiSrc,
      umamiWebsiteId,
      enabled: Boolean(umamiSrc && umamiWebsiteId),
    }),
  });
}

export const runtimeConfig = createRuntimeConfig(import.meta.env);
