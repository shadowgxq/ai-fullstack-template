import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { i18n } from '../i18n';
import { createRequestClient } from './requestClient';

describe('request client language interceptor', () => {
  it('adds the current UI language to ordinary HTTP requests', async () => {
    const originalLanguage = i18n.language;
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    try {
      await i18n.changeLanguage('zh');
      const client = createRequestClient({
        adapter: async (config) => {
          capturedConfig = config;
          return {
            config,
            data: { ok: true },
            headers: {},
            status: 200,
            statusText: 'OK',
          };
        },
      });

      await client.get('/v1/language-check');

      expect(capturedConfig?.headers.get('Accept-Language')).toBe('zh-CN');
    } finally {
      await i18n.changeLanguage(originalLanguage);
    }
  });
});
