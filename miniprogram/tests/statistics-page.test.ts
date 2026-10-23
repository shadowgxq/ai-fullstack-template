// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { queryClient } from '../src/shared/query/client';
import type { Statistics } from '../src/features/statistics/api';

const host = vi.hoisted(() => ({ show: () => {}, bottom: () => {} }));
vi.mock('@tarojs/taro', async (original) => ({
  ...(await original<object>()),
  useDidShow: (callback: () => void) => {
    host.show = callback;
  },
}));
vi.mock('@tarojs/components', () => ({ Text: 'span', View: 'div' }));
vi.mock('../src/shared/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => createElement('button', { onClick, disabled }, children),
  Notice: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  StatePanel: ({ title }: { title: string }) => createElement('div', null, title),
}));
vi.mock('../src/features/wardrobe/Page', () => ({
  WardrobePage: ({
    children,
    onReachBottom,
  }: {
    children?: ReactNode;
    onReachBottom: () => void;
  }) => {
    host.bottom = onReachBottom;
    return createElement('main', null, children);
  },
}));
vi.mock('../src/features/wardrobe/api', async (original) => ({
  ...(await original<object>()),
  wardrobeApi: { options: async () => ({ categories: [] }) },
}));
vi.mock('../src/features/statistics/StatisticsContent', () => ({
  StatisticsContent: ({ value }: { value: Statistics }) =>
    createElement('div', null, value.trend.end_date),
  GarmentCountRows: ({ items }: { items: Statistics['garment_counts']['items'] }) =>
    createElement('div', null, items.map((item) => item.name).join(',')),
}));
import StatisticsPage from '../src/pages/statistics';

// ReactDOM is already part of the app; this exercises real hooks and query observers.
const { createRoot } = createRequire(import.meta.url)('react-dom/client') as {
  createRoot: (node: HTMLElement) => { render: (node: ReactNode) => void; unmount: () => void };
};
let root: ReturnType<typeof createRoot>;
let container: HTMLElement;
type Call = {
  url: string;
  success: (response: { statusCode: number; data: unknown }) => void;
};
let calls: Call[];
let aborts: ReturnType<typeof vi.fn>[];
function value(day: string, label: string, cursor: string | null = 'next-page'): Statistics {
  const end = Date.parse(day + 'T00:00:00Z');
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(end - (29 - index) * 86400000).toISOString().slice(0, 10),
    count: 0,
  }));
  return {
    wardrobe_total: 3,
    archived_count: 0,
    category_counts: [{ category: null, count: 3 }],
    wear_record_count: 0,
    trend: { start_date: days[0].date, end_date: day, timezone: 'Asia/Shanghai', days },
    garment_counts: {
      items: [
        {
          garment_id: '11111111-1111-4111-8111-111111111111',
          name: label,
          category: null,
          status: 'wearable',
          wear_count: 0,
        },
      ],
      next_cursor: cursor,
    },
  };
}
async function flush() {
  await act(async () => {
    for (let index = 0; index < 3; index += 1) await vi.advanceTimersByTimeAsync(0);
  });
}
async function respond(index: number, body: Statistics) {
  await act(async () => {
    calls[index].success({ statusCode: 200, data: { code: 0, message: 'ok', data: body } });
  });
  await flush();
}
async function mount() {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: queryClient }, createElement(StatisticsPage)),
    );
  });
  await flush();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T15:59:59Z'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('statistics-owner-one', 1);
  calls = [];
  aborts = [];
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    const abort = vi.fn();
    aborts.push(abort);
    return Object.assign(new Promise(() => {}), { abort });
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    queryClient.clear();
  });
  container.remove();
  vi.useRealTimers();
});

describe('statistics page business-day lifecycle', () => {
  it('switches to a new first page at Shanghai midnight, hides old pages and rejects late old cursors', async () => {
    await mount();
    await respond(0, value('2026-10-22', 'old-first'));
    await act(async () => {
      host.bottom();
    });
    expect(calls[1].url).toContain('garment_cursor=next-page');
    await respond(1, value('2026-10-22', 'old-second', 'old-cursor'));
    expect(container.textContent).toContain('old-first,old-second');
    await act(async () => {
      host.bottom();
    });
    expect(calls[2].url).toContain('garment_cursor=old-cursor');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flush();
    expect(calls).toHaveLength(4);
    expect(calls[3].url).not.toContain('garment_cursor');
    expect(aborts[2]).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('old-first');
    expect(container.textContent).not.toContain('2026-10-22');
    await respond(2, value('2026-10-22', 'late-old'));
    expect(container.textContent).not.toContain('late-old');
    await respond(3, value('2026-10-23', 'new-first', null));
    expect(container.textContent).toContain('2026-10-23');
    expect(container.textContent).toContain('new-first');
    expect(container.textContent).not.toContain('old-second');
    expect(container.textContent).not.toContain('加载更多衣物');
  });

  it('refreshes the day on foreground return before reusing pages and separates a changed account', async () => {
    await mount();
    await respond(0, value('2026-10-22', 'old-owner'));
    const previousSession = getAuthSession()!;
    // Suspended runtimes can resume without delivering the midnight timer first.
    vi.setSystemTime(new Date('2026-10-23T02:00:00Z'));
    await act(async () => {
      host.show();
    });
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1].url).not.toContain('garment_cursor');
    expect(container.textContent).not.toContain('old-owner');
    await act(async () => {
      saveAuthSession('statistics-owner-two', 2);
    });
    await flush();
    expect(getAuthSession()).not.toBe(previousSession);
    expect(calls).toHaveLength(3);
    expect(aborts[1]).toHaveBeenCalledOnce();
    await respond(1, value('2026-10-23', 'late-owner-one'));
    expect(container.textContent).not.toContain('late-owner-one');
    await respond(2, value('2026-10-23', 'owner-two', null));
    expect(container.textContent).toContain('owner-two');
    expect(container.textContent).not.toContain('old-owner');
  });
});
