import { describe, expect, it } from 'vitest';

import {
  createRuntimeConfig,
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_TRANSLATION_API_BASE_URL,
  DEFAULT_TRANSLATION_TIMEOUT_MS,
} from './runtime-config';

describe('createRuntimeConfig', () => {
  it('normalizes configured API values', () => {
    expect(
      createRuntimeConfig({
        VITE_API_BASE_URL: ' /api/v2 ',
        VITE_API_TIMEOUT_MS: '15000',
      }),
    ).toEqual({
      api: {
        baseUrl: '/api/v2',
        timeoutMs: 15000,
      },
      translation: {
        baseUrl: DEFAULT_TRANSLATION_API_BASE_URL,
        timeoutMs: DEFAULT_TRANSLATION_TIMEOUT_MS,
      },
      auth: {
        dataSource: 'api',
        googleClientId: undefined,
      },
      analytics: {
        umamiSrc: undefined,
        umamiWebsiteId: undefined,
        enabled: false,
      },
    });
  });

  it('uses safe defaults for empty or invalid values', () => {
    expect(
      createRuntimeConfig({
        VITE_API_BASE_URL: '  ',
        VITE_API_TIMEOUT_MS: '-1',
      }),
    ).toEqual({
      api: {
        baseUrl: DEFAULT_API_BASE_URL,
        timeoutMs: DEFAULT_API_TIMEOUT_MS,
      },
      translation: {
        baseUrl: DEFAULT_TRANSLATION_API_BASE_URL,
        timeoutMs: DEFAULT_TRANSLATION_TIMEOUT_MS,
      },
      auth: {
        dataSource: 'api',
        googleClientId: undefined,
      },
      analytics: {
        umamiSrc: undefined,
        umamiWebsiteId: undefined,
        enabled: false,
      },
    });
  });

  it('normalizes translation proxy configuration independently from the product API', () => {
    expect(
      createRuntimeConfig({
        VITE_TRANSLATION_API_BASE_URL: ' /translations ',
        VITE_TRANSLATION_TIMEOUT_MS: '12000',
      }).translation,
    ).toEqual({ baseUrl: '/translations', timeoutMs: 12000 });
  });

  it('enables isolated auth mock and normalizes the public Google client id', () => {
    expect(
      createRuntimeConfig({
        VITE_AUTH_DATA_SOURCE: ' MOCK ',
        VITE_GOOGLE_CLIENT_ID: ' client-id ',
      }),
    ).toMatchObject({
      auth: {
        dataSource: 'mock',
        googleClientId: 'client-id',
      },
    });
  });

  it('埋点两个变量都配齐才开启', () => {
    expect(createRuntimeConfig({}).analytics.enabled).toBe(false);
    // 只配一个不算开启：不做「有 src 无 id 也插脚本」这种半开状态。
    expect(
      createRuntimeConfig({ VITE_UMAMI_SRC: 'https://u.example/script.js' }).analytics.enabled,
    ).toBe(false);
    expect(createRuntimeConfig({ VITE_UMAMI_WEBSITE_ID: 'w-1' }).analytics.enabled).toBe(false);
    expect(
      createRuntimeConfig({
        VITE_UMAMI_SRC: ' https://u.example/script.js ',
        VITE_UMAMI_WEBSITE_ID: ' w-1 ',
      }),
    ).toMatchObject({
      analytics: { umamiSrc: 'https://u.example/script.js', umamiWebsiteId: 'w-1', enabled: true },
    });
  });
});
