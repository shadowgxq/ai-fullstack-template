import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCachedTranslations,
  resetTranslationCacheForTests,
  saveCachedTranslations,
} from './translation.local-cache';
import { TRANSLATION_CACHE_STORAGE_KEY, TRANSLATION_CACHE_TTL_MS } from './translation.types';

const SOURCE_LANGUAGE = 'en-US';
const TARGET_LANGUAGE = 'zh-CN';

beforeEach(() => {
  localStorage.clear();
  resetTranslationCacheForTests();
});

describe('translation local cache', () => {
  it('在 7 天内命中，到期后失效', async () => {
    const cachedAt = 1_000;
    await saveCachedTranslations(
      new Map([['Gold is under pressure', '黄金承压']]),
      SOURCE_LANGUAGE,
      TARGET_LANGUAGE,
      cachedAt,
    );

    await expect(
      getCachedTranslations(
        ['Gold is under pressure'],
        SOURCE_LANGUAGE,
        TARGET_LANGUAGE,
        cachedAt + TRANSLATION_CACHE_TTL_MS - 1,
      ),
    ).resolves.toEqual(new Map([['Gold is under pressure', '黄金承压']]));
    await expect(
      getCachedTranslations(
        ['Gold is under pressure'],
        SOURCE_LANGUAGE,
        TARGET_LANGUAGE,
        cachedAt + TRANSLATION_CACHE_TTL_MS,
      ),
    ).resolves.toEqual(new Map());
  });

  it('按语言方向与规范化原文隔离缓存', async () => {
    await saveCachedTranslations(
      new Map([['  Gold rose\r\ntoday  ', '黄金今天上涨']]),
      SOURCE_LANGUAGE,
      TARGET_LANGUAGE,
      2_000,
    );

    await expect(
      getCachedTranslations(['Gold rose\ntoday'], SOURCE_LANGUAGE, TARGET_LANGUAGE, 2_001),
    ).resolves.toEqual(new Map([['Gold rose\ntoday', '黄金今天上涨']]));
    await expect(
      getCachedTranslations(['Gold rose\ntoday'], TARGET_LANGUAGE, SOURCE_LANGUAGE, 2_001),
    ).resolves.toEqual(new Map());
  });

  it('损坏的缓存不会阻塞读取', async () => {
    localStorage.setItem(TRANSLATION_CACHE_STORAGE_KEY, '{not-json');
    resetTranslationCacheForTests();

    await expect(
      getCachedTranslations(['Gold'], SOURCE_LANGUAGE, TARGET_LANGUAGE, 3_000),
    ).resolves.toEqual(new Map());
    expect(localStorage.getItem(TRANSLATION_CACHE_STORAGE_KEY)).toBeNull();
  });
});
