import { describe, expect, it } from 'vitest';

import {
  createRuntimeConfig,
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT_MS,
} from './runtime-config';

describe('createRuntimeConfig', () => {
  it('normalizes configured API values', () => {
    expect(
      createRuntimeConfig({
        VITE_API_BASE_URL: ' /api/v2 ',
        VITE_API_TIMEOUT_MS: '15000',
        VITE_DATA_SOURCE: ' API ',
        VITE_RESEARCH_DATA_SOURCE: ' mock ',
        VITE_GOOGLE_CLIENT_ID: ' client-id-123 ',
        VITE_GOOGLE_AUTH_MODE: ' CODE ',
      }),
    ).toEqual({
      api: {
        baseUrl: '/api/v2',
        timeoutMs: 15000,
      },
      dataSource: 'api',
      researchDataSource: 'mock',
      googleClientId: 'client-id-123',
      googleAuthMode: 'code',
    });
  });

  it('uses safe defaults for empty or invalid values', () => {
    expect(
      createRuntimeConfig({
        VITE_API_BASE_URL: '  ',
        VITE_API_TIMEOUT_MS: '-1',
        VITE_DATA_SOURCE: 'remote',
        VITE_GOOGLE_CLIENT_ID: '  ',
      }),
    ).toEqual({
      api: {
        baseUrl: DEFAULT_API_BASE_URL,
        timeoutMs: DEFAULT_API_TIMEOUT_MS,
      },
      dataSource: 'api',
      researchDataSource: 'api',
      googleClientId: undefined,
      googleAuthMode: 'idtoken',
    });
  });

  // 漏配或写错值必须落回 idtoken：那条链路不依赖后端 client-secret，任何时候都能登录。
  it('falls back to the id token flow for anything but an explicit code mode', () => {
    expect(createRuntimeConfig({ VITE_GOOGLE_AUTH_MODE: 'oauth-code' }).googleAuthMode).toBe(
      'idtoken',
    );
    expect(createRuntimeConfig({}).googleAuthMode).toBe('idtoken');
  });
});
