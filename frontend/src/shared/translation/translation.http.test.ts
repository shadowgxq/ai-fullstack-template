import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  createRequest: () => requestMock,
}));

const { translationApi } = await import('./translation.client');

beforeEach(() => {
  requestMock.mockReset();
});

describe('translation HTTP contract', () => {
  it('按翻译服务契约发送英文到中文的批量请求', async () => {
    requestMock.mockImplementation(async (requestConfig) => ({
      source_lang: 'en-US',
      target_lang: 'zh-CN',
      provider_calls: 1,
      items: [
        {
          id: requestConfig.data.items[0].id,
          translated_text: '黄金价格今天上涨。',
          cache_status: 'translated',
        },
      ],
    }));

    const result = await translationApi.requestBatch(['Gold prices rose today.'], 'en-US', 'zh-CN');
    const requestConfig = requestMock.mock.calls[0]?.[0];

    expect(requestConfig).toMatchObject({
      method: 'POST',
      url: '/v1/translations',
      data: {
        source_lang: 'en-US',
        target_lang: 'zh-CN',
        items: [{ text: 'Gold prices rose today.' }],
      },
    });
    expect(requestConfig.data.items[0].id).toMatch(/^text-/u);
    expect(result).toEqual(new Map([['Gold prices rose today.', '黄金价格今天上涨。']]));
  });
});
