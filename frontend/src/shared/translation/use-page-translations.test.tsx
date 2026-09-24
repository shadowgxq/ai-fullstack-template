import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localeState = vi.hoisted(() => ({ locale: 'zh' as 'en' | 'zh' }));
const translateTextsMock = vi.hoisted(() => vi.fn());

vi.mock('../i18n', () => ({
  useLocale: () => ({ locale: localeState.locale }),
}));

vi.mock('./translation.client', () => ({
  translateTexts: translateTextsMock,
}));

const { usePageTranslations } = await import('./use-page-translations');

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  localeState.locale = 'zh';
  translateTextsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePageTranslations', () => {
  it('英文界面不发请求，直接显示服务端英文', () => {
    localeState.locale = 'en';
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fields = [{ id: 'title', text: 'Gold rose today.' }];
    const { result } = renderHook(
      () =>
        usePageTranslations({
          pageKey: 'result',
          sourceLanguage: 'en-US',
          fields,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.resolve(fields[0].text)).toEqual({
      text: 'Gold rose today.',
      status: 'source',
    });
    expect(translateTextsMock).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('用户从英文切换到中文时才触发固定语言方向的翻译', async () => {
    localeState.locale = 'en';
    translateTextsMock.mockResolvedValue(new Map([['Gold rose today.', '黄金今天上涨。']]));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fields = [{ id: 'title', text: 'Gold rose today.' }];
    const { result, rerender } = renderHook(
      () =>
        usePageTranslations({
          pageKey: 'result',
          sourceLanguage: 'en-US',
          fields,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(translateTextsMock).not.toHaveBeenCalled();
    localeState.locale = 'zh';
    rerender();

    await waitFor(() => {
      expect(translateTextsMock).toHaveBeenCalledWith(
        expect.objectContaining({ sourceLanguage: 'en-US', targetLanguage: 'zh-CN' }),
      );
      expect(result.current.resolve(fields[0].text).text).toBe('黄金今天上涨。');
    });
    queryClient.clear();
  });

  it('切换中文后最多显示 5 秒 Skeleton，超时回退英文', () => {
    vi.useFakeTimers();
    translateTextsMock.mockReturnValue(new Promise(() => undefined));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fields = [{ id: 'title', text: 'Gold rose today.' }];
    const { result } = renderHook(
      () =>
        usePageTranslations({
          pageKey: 'result',
          sourceLanguage: 'en-US',
          fields,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.resolve(fields[0].text).status).toBe('loading');
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.resolve(fields[0].text)).toEqual({
      text: 'Gold rose today.',
      status: 'fallback',
    });
    queryClient.clear();
  });

  it('超时后的迟到翻译仍会替换英文兜底', async () => {
    let resolveRequest: ((value: Map<string, string>) => void) | undefined;
    translateTextsMock.mockReturnValue(
      new Promise<Map<string, string>>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fields = [{ id: 'title', text: 'Gold rose today.' }];
    const { result } = renderHook(
      () =>
        usePageTranslations({
          pageKey: 'result',
          sourceLanguage: 'en-US',
          fields,
          waitTimeoutMs: 10,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(resolveRequest).toBeDefined();
      expect(result.current.resolve(fields[0].text).status).toBe('fallback');
    });

    await act(async () => {
      resolveRequest?.(new Map([['Gold rose today.', '黄金今天上涨。']]));
    });
    await waitFor(() => {
      expect(result.current.resolve(fields[0].text)).toEqual({
        text: '黄金今天上涨。',
        status: 'translated',
      });
    });
    queryClient.clear();
  });
});
