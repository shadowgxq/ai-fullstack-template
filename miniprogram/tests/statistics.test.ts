import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfiniteQueryObserver } from '@tanstack/react-query';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { queryClient } from '../src/shared/query/client';
import { wardrobeApi } from '../src/features/wardrobe/api';
import { changeGarmentStatus, invalidateGarmentFacts } from '../src/features/wardrobe/queries';
import { invalidateWearFacts } from '../src/features/wear-history/queries';
import { parseStatistics, statisticsApi, type Statistics } from '../src/features/statistics/api';
import {
  recoverStatisticsCursor,
  statisticsQueryOptions,
  StatisticsCursorExpired,
} from '../src/features/statistics/queries';

const garmentId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const thirdId = '33333333-3333-4333-8333-333333333333';
function statistics(): Statistics {
  return {
    wardrobe_total: 2,
    archived_count: 1,
    category_counts: [{ category: null, count: 2 }],
    wear_record_count: 5,
    trend: {
      start_date: '2024-02-20',
      end_date: '2024-03-20',
      timezone: 'Asia/Shanghai',
      days: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(Date.parse('2024-02-20T00:00:00Z') + index * 86400000)
          .toISOString()
          .slice(0, 10),
        count: index === 29 ? 1 : 0,
      })),
    },
    garment_counts: {
      items: [
        { garment_id: garmentId, name: '衬衫', category: null, status: 'wearable', wear_count: 5 },
        {
          garment_id: secondId,
          name: null,
          category: 'unknown',
          status: 'archived',
          wear_count: 0,
        },
      ],
      next_cursor: 'next/+',
    },
  };
}
type Call = {
  url: string;
  method: string;
  data?: unknown;
  success: (response: { statusCode: number; data: unknown }) => void;
  fail: () => void;
};
let calls: Call[];
let abort: ReturnType<typeof vi.fn>;
function success(call: Call, data: unknown) {
  call.success({ statusCode: 200, data: { code: 0, message: 'ok', data } });
}
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('statistics-token', 1);
  calls = [];
  abort = vi.fn();
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return Object.assign(new Promise(() => {}), { abort });
  });
});

describe('statistics provider contract', () => {
  it('keeps missing status counts unknown and rejects inconsistent status totals', () => {
    const old = parseStatistics(statistics());
    expect(old.wearable_count).toBeNull();
    expect(old.unavailable_count).toBeNull();
    expect(
      parseStatistics({ ...statistics(), wearable_count: 1, unavailable_count: 1 }),
    ).toMatchObject({ wearable_count: 1, unavailable_count: 1 });
    expect(() =>
      parseStatistics({ ...statistics(), wearable_count: 2, unavailable_count: 1 }),
    ).toThrow();
    expect(() => parseStatistics({ ...statistics(), wearable_count: 3 })).toThrow();
    expect(() => parseStatistics({ ...statistics(), wearable_count: -1 })).toThrow();
  });
  it('preserves full counts beyond the 30-day window, null categories, zero and archived rows', () => {
    const result = parseStatistics(statistics());
    expect(result.wear_record_count).toBe(5);
    expect(result.trend.days.reduce((sum, day) => sum + day.count, 0)).toBe(1);
    expect(result.category_counts).toEqual([{ category: null, count: 2 }]);
    expect(result.garment_counts.items[1]).toMatchObject({
      name: null,
      status: 'archived',
      wear_count: 0,
    });
  });
  it('rejects inconsistent date windows, malformed counts and unbounded or unstable garment pages', () => {
    const short = statistics();
    short.trend.days.pop();
    expect(() => parseStatistics(short)).toThrow();
    const range = statistics();
    range.trend.end_date = '2024-03-19';
    expect(() => parseStatistics(range)).toThrow();
    const timezone = statistics();
    expect(() =>
      parseStatistics({ ...timezone, trend: { ...timezone.trend, timezone: 'UTC' } }),
    ).toThrow();
    const sum = statistics();
    sum.category_counts[0].count = 1;
    expect(() => parseStatistics(sum)).toThrow();
    const negative = statistics();
    negative.garment_counts.items[0].wear_count = -1;
    expect(() => parseStatistics(negative)).toThrow();
    const tooMany = statistics();
    tooMany.garment_counts.items = Array(101).fill(tooMany.garment_counts.items[0]);
    expect(() => parseStatistics(tooMany)).toThrow();
    const duplicate = statistics();
    duplicate.garment_counts.items[1] = duplicate.garment_counts.items[0];
    expect(() => parseStatistics(duplicate)).toThrow();
    const order = statistics();
    order.garment_counts.items.reverse();
    expect(() => parseStatistics(order)).toThrow();
  });
  it('accepts multiple zero-count inventory UUIDs in provider DESC order and rejects a tie inversion', () => {
    const inventory = statistics();
    inventory.wear_record_count = 0;
    inventory.trend.days = inventory.trend.days.map((day) => ({ ...day, count: 0 }));
    inventory.garment_counts.items = [thirdId, secondId, garmentId].map((id) => ({
      garment_id: id,
      name: null,
      category: null,
      status: 'wearable',
      wear_count: 0,
    }));
    expect(parseStatistics(inventory).garment_counts.items.map((item) => item.garment_id)).toEqual([
      thirdId,
      secondId,
      garmentId,
    ]);
    [inventory.garment_counts.items[0], inventory.garment_counts.items[1]] = [
      inventory.garment_counts.items[1],
      inventory.garment_counts.items[0],
    ];
    expect(() => parseStatistics(inventory)).toThrow();
    inventory.garment_counts.items = [
      'bbbbbbbb-1111-4111-8111-111111111111',
      'AAAAAAAA-1111-4111-8111-111111111111',
    ].map((id) => ({
      garment_id: id,
      name: null,
      category: null,
      status: 'archived',
      wear_count: 0,
    }));
    expect(parseStatistics(inventory).garment_counts.items).toHaveLength(2);
  });

  it('requests a bounded page with an encoded garment cursor', async () => {
    const pending = statisticsApi.read('signed/+');
    expect(calls[0].url).toContain('page_size=20');
    expect(calls[0].url).toContain('garment_cursor=signed%2F%2B');
    success(calls[0], statistics());
    await pending;
  });
});

describe('statistics query and write consumers', () => {
  it('loads the bounded next page and recovers a revision or midnight conflict from page one', async () => {
    const session = getAuthSession()!;
    const observer = new InfiniteQueryObserver(queryClient, statisticsQueryOptions(session));
    const unsubscribe = observer.subscribe(() => undefined);
    success(calls[0], statistics());
    await vi.waitFor(() => expect(observer.getCurrentResult().hasNextPage).toBe(true));
    const next = observer.fetchNextPage();
    expect(calls[1].url).toContain('garment_cursor=next%2F%2B');
    const page2 = statistics();
    page2.garment_counts = {
      items: [
        { garment_id: thirdId, name: '长裤', category: null, status: 'unavailable', wear_count: 0 },
      ],
      next_cursor: 'next-again',
    };
    success(calls[1], page2);
    await next;
    expect(observer.getCurrentResult().data?.pages).toHaveLength(2);
    const expired = observer.fetchNextPage();
    calls[2].success({ statusCode: 409, data: {} });
    await expired;
    const error = observer.getCurrentResult().error;
    expect(error).toBeInstanceOf(StatisticsCursorExpired);
    const recovery = recoverStatisticsCursor(session, error);
    expect(calls[3].url).not.toContain('garment_cursor=');
    const current = statistics();
    current.garment_counts.next_cursor = null;
    current.wear_record_count = 6;
    success(calls[3], current);
    await recovery;
    expect(observer.getCurrentResult().data?.pages).toHaveLength(1);
    expect(observer.getCurrentResult().data?.pageParams).toEqual([null]);
    expect(observer.getCurrentResult().data?.pages[0].wear_record_count).toBe(6);
    unsubscribe();
  });
  it('refreshes the actual observer after garment status, successful garment save and wear writes', async () => {
    const session = getAuthSession()!;
    const observer = new InfiniteQueryObserver(queryClient, statisticsQueryOptions(session));
    const unsubscribe = observer.subscribe(() => undefined);
    const initial = statistics();
    initial.garment_counts.next_cursor = null;
    success(calls[0], initial);
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    const status = changeGarmentStatus(session, { id: garmentId, version: 1 }, 'archived');
    expect(calls[1].method).toBe('PATCH');
    success(calls[1], {
      id: garmentId,
      version: 2,
      status: 'archived',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    const archived = {
      ...initial,
      wardrobe_total: 1,
      archived_count: 2,
      category_counts: [{ category: null, count: 1 }],
    };
    success(calls[2], archived);
    await status;
    expect(observer.getCurrentResult().data?.pages[0].archived_count).toBe(2);
    const create = wardrobeApi.create({ name: '新衣物' }, 'new-garment');
    success(calls[3], { id: thirdId, version: 1 });
    await create;
    const afterSave = invalidateGarmentFacts(session, thirdId);
    expect(calls).toHaveLength(5);
    success(calls[4], { ...initial, archived_count: 2 });
    await afterSave;
    expect(observer.getCurrentResult().data?.pages[0].wardrobe_total).toBe(2);
    const afterWear = invalidateWearFacts(session);
    success(calls[5], { ...initial, wear_record_count: 6 });
    await afterWear;
    expect(observer.getCurrentResult().data?.pages[0].wear_record_count).toBe(6);
    unsubscribe();
  });
  it('aborts old account reads, refuses late results and prevents an old cursor reset from touching the new session', async () => {
    const oldSession = getAuthSession()!;
    const observer = new InfiniteQueryObserver(queryClient, statisticsQueryOptions(oldSession));
    const unsubscribe = observer.subscribe(() => undefined);
    saveAuthSession('second-owner', 2);
    success(calls[0], statistics());
    await Promise.resolve();
    expect(queryClient.getQueryData(statisticsQueryOptions(oldSession).queryKey)).toBeUndefined();
    expect(abort).toHaveBeenCalled();
    const newSession = getAuthSession()!;
    observer.setOptions(statisticsQueryOptions(newSession));
    success(calls[1], { ...statistics(), wear_record_count: 8 });
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.pages[0].wear_record_count).toBe(8),
    );
    const count = calls.length;
    await recoverStatisticsCursor(oldSession, new StatisticsCursorExpired());
    expect(calls).toHaveLength(count);
    expect(observer.getCurrentResult().data?.pages[0].wear_record_count).toBe(8);
    unsubscribe();
  });
  it('keeps a network error visible and recovers only an actual cursor conflict', async () => {
    const session = getAuthSession()!;
    const observer = new InfiniteQueryObserver(queryClient, {
      ...statisticsQueryOptions(session),
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    calls[0].fail();
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    const before = calls.length;
    await recoverStatisticsCursor(session, observer.getCurrentResult().error);
    expect(calls).toHaveLength(before);
    const retry = observer.refetch();
    success(calls[1], statistics());
    await retry;
    expect(observer.getCurrentResult().isSuccess).toBe(true);
    unsubscribe();
  });
});
