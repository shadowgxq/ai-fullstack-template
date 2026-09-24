import { beforeEach, describe, expect, it, vi } from 'vitest';

import { translateTexts, translationApi } from './translation.client';
import { resetTranslationCacheForTests } from './translation.local-cache';

beforeEach(() => {
  localStorage.clear();
  resetTranslationCacheForTests();
  vi.restoreAllMocks();
});

describe('translation client', () => {
  it('按原文去重，成功结果写入语言方向缓存', async () => {
    const requestBatch = vi.spyOn(translationApi, 'requestBatch').mockResolvedValue(
      new Map([
        ['Gold is under pressure', '黄金承压'],
        ['The dollar weakened', '美元走弱'],
      ]),
    );

    await expect(
      translateTexts({
        texts: [' Gold is under pressure ', 'Gold is under pressure', 'The dollar weakened'],
        sourceLanguage: 'en-US',
        targetLanguage: 'zh-CN',
      }),
    ).resolves.toEqual(
      new Map([
        ['Gold is under pressure', '黄金承压'],
        ['The dollar weakened', '美元走弱'],
      ]),
    );
    expect(requestBatch).toHaveBeenCalledTimes(1);
    expect(requestBatch).toHaveBeenCalledWith(
      ['Gold is under pressure', 'The dollar weakened'],
      'en-US',
      'zh-CN',
      undefined,
    );

    requestBatch.mockClear();
    await translateTexts({
      texts: ['Gold is under pressure', 'The dollar weakened'],
      sourceLanguage: 'en-US',
      targetLanguage: 'zh-CN',
    });
    expect(requestBatch).not.toHaveBeenCalled();
  });

  it('翻译服务失败时返回空翻译，调用方继续显示英文原文', async () => {
    vi.spyOn(translationApi, 'requestBatch').mockRejectedValue(new Error('service unavailable'));

    await expect(
      translateTexts({
        texts: ['Gold is under pressure'],
        sourceLanguage: 'en-US',
        targetLanguage: 'zh-CN',
      }),
    ).resolves.toEqual(new Map());
  });
});
