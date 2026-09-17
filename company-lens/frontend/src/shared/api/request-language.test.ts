import { describe, expect, it } from 'vitest';

import { getApiLanguageHeaders, toApiLanguage } from './request-language';

describe('request language', () => {
  it.each([
    ['en', 'en-US'],
    ['en-US', 'en-US'],
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    [undefined, 'zh-CN'],
  ] as const)('maps %s to the product-server language %s', (locale, expected) => {
    expect(toApiLanguage(locale)).toBe(expected);
  });

  it('returns the UI language header in the backend contract format', () => {
    expect(getApiLanguageHeaders()).toEqual({
      'Accept-Language': expect.stringMatching(/^(zh-CN|en-US)$/),
      'X-Lang': expect.stringMatching(/^(zh-CN|en-US)$/),
    });
  });
});
