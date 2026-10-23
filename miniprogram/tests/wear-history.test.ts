import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfiniteQueryObserver, QueryObserver } from '@tanstack/react-query';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';
import {
  wardrobeApi,
  parseGarmentDetail,
  type Garment,
  type GarmentDetail,
} from '../src/features/wardrobe/api';
import { garmentListQueryOptions, changeGarmentStatus } from '../src/features/wardrobe/queries';
import { emptyWearDraft, validateWearDraft } from '../src/features/wear-history/draft';
import {
  isCalendarDate,
  shanghaiToday,
  validateDateRange,
  validateWearDate,
} from '../src/features/wear-history/date';
import { WearEditor } from '../src/features/wear-history/editor';
import { returnAfterWearSave } from '../src/features/wear-history/navigation';
import {
  draftFromWear,
  parseWearCreated,
  parseWearDeleted,
  parseWearList,
  parseWearRecord,
  wearApi,
  wearInput,
  type WearRecord,
} from '../src/features/wear-history/api';
import { invalidateWearFacts, wearListQueryOptions } from '../src/features/wear-history/queries';

const garmentId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const recordId = '33333333-3333-4333-8333-333333333333';
const record: WearRecord = {
  id: recordId,
  version: 1,
  wear_date: '2020-01-01',
  created_at: '2020-01-01T01:00:00Z',
  updated_at: '2020-01-01T01:00:00Z',
  items: [{ garment_id: garmentId, name_snapshot: '旧名称', category_snapshot: null }],
};
const garment: Garment = {
  id: garmentId,
  version: 1,
  name: '当前名称',
  category: null,
  color: null,
  photo_media_id: null,
  season: [],
  occasion: [],
  tags: [],
  notes: null,
  status: 'wearable',
  created_at: record.created_at,
  updated_at: record.updated_at,
};
type Call = {
  url: string;
  method: string;
  data?: Record<string, unknown>;
  header: Record<string, string>;
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
  saveAuthSession('wear-token', 1);
  calls = [];
  abort = vi.fn();
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return Object.assign(new Promise(() => {}), { abort });
  });
});

describe('wear dates and generated contracts', () => {
  it('uses Beijing midnight regardless of device time zone and rejects future/calendar-invalid dates', () => {
    const before = Date.parse('2026-01-01T15:59:59.999Z');
    const after = Date.parse('2026-01-01T16:00:00Z');
    expect(shanghaiToday(before)).toBe('2026-01-01');
    expect(shanghaiToday(after)).toBe('2026-01-02');
    expect(emptyWearDraft(after)).toEqual({ wearDate: '2026-01-02', garmentIds: [] });
    expect(validateWearDate('2026-01-02', before)).toContain('未来');
    expect(validateWearDate('2026-01-02', after)).toBeNull();
    expect(isCalendarDate('2024-02-29')).toBe(true);
    for (const invalid of [
      '2025-02-29',
      '2026-02-30',
      '2026-1-01',
      '2026-01-01T00:00:00Z',
      '0000-01-01',
    ])
      expect(isCalendarDate(invalid)).toBe(false);
    expect(validateDateRange('2026-02-01', '2026-01-01')).toContain('晚于');
    expect(validateDateRange('2026-01-01', '2026-01-01')).toBeNull();
    expect(validateDateRange('', '')).toBeNull();
  });
  it('retains unknown snapshot values, rejects malformed dates/items and canonicalizes only the save payload', () => {
    expect(parseWearRecord(record).items[0]).toEqual(record.items[0]);
    expect(() => parseWearRecord({ ...record, wear_date: '2020-02-30' })).toThrow();
    expect(() => parseWearRecord({ ...record, items: [] })).toThrow();
    expect(() =>
      parseWearRecord({ ...record, items: [record.items[0], record.items[0]] }),
    ).toThrow();
    expect(() => parseWearRecord({ ...record, items: [{ garment_id: garmentId }] })).toThrow();
    expect(() => parseWearList({ items: [], next_cursor: 3 })).toThrow();
    expect(() => parseWearDeleted({ id: recordId, deleted: false })).toThrow();
    expect(() => parseWearCreated({ id: recordId, version: 0 })).toThrow();
    const draft = { wearDate: '2020-01-01', garmentIds: [secondId, garmentId, secondId] };
    expect(wearInput(draft).garment_ids).toEqual([garmentId, secondId]);
    expect(draft.garmentIds).toHaveLength(3);
    expect(validateWearDraft({ ...draft, garmentIds: [] })).toContain('至少一件');
    expect(validateWearDraft({ ...draft, garmentIds: Array(1001).fill(garmentId) })).toContain(
      '1000',
    );
  });
  it('requires a nonnegative real count in the separate garment detail decoder', () => {
    expect(parseGarmentDetail({ ...garment, wear_count: 0 }).wear_count).toBe(0);
    for (const count of [undefined, null, -1, 1.5, '0'])
      expect(() => parseGarmentDetail({ ...garment, wear_count: count })).toThrow();
  });
});

describe('wear write recovery and owner boundaries', () => {
  it('reuses one receipt after response loss and never writes again after successful save/navigation failure', async () => {
    const editor = new WearEditor(getAuthSession()!);
    const draft = draftFromWear(record);
    const first = editor.save(draft);
    const key = calls[0].header['Idempotency-Key'];
    calls[0].fail();
    await expect(first).rejects.toMatchObject({ kind: 'network' });
    expect(editor.uncertain).toBe(true);
    await expect(editor.save({ ...draft, garmentIds: [secondId] })).rejects.toThrow('原操作');
    expect(calls).toHaveLength(1);
    const retry = editor.save(draft);
    expect(calls[1].header['Idempotency-Key']).toBe(key);
    expect(calls[1].data).toEqual(calls[0].data);
    success(calls[1], { id: recordId, version: 1 });
    await retry;
    Taro.navigateBack.mockRejectedValueOnce(new Error('navigation failed'));
    Taro.redirectTo.mockRejectedValueOnce(new Error('navigation failed'));
    await expect(returnAfterWearSave(() => Boolean(getAuthSession()))).rejects.toThrow(
      'navigation failed',
    );
    expect(editor.saved).toBe(true);
    await expect(editor.save(draft)).resolves.toEqual({ id: recordId, version: 1 });
    expect(calls).toHaveLength(2);
  });
  it.each(['session', 'signal'] as const)(
    'does not navigate an old fallback after %s changes while back is pending',
    async (change) => {
      const session = getAuthSession();
      const controller = new AbortController();
      let failBack!: (error: Error) => void;
      Taro.navigateBack.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            failBack = reject;
          }),
      );
      const active = () => getAuthSession() === session && !controller.signal.aborted;
      const navigation = returnAfterWearSave(active);
      if (change === 'session') saveAuthSession('new-owner', 2);
      else controller.abort();
      failBack(new Error('no return stack'));
      await expect(navigation).rejects.toMatchObject({ name: 'AbortError' });
      expect(Taro.redirectTo).not.toHaveBeenCalled();
      await expect(returnAfterWearSave(active)).rejects.toMatchObject({ name: 'AbortError' });
      expect(Taro.navigateBack).toHaveBeenCalledOnce();
    },
  );

  it('allows corrected content with a new receipt after definite 422 and keeps draft intact', async () => {
    const editor = new WearEditor(getAuthSession()!);
    const draft = draftFromWear(record);
    const first = editor.save(draft);
    calls[0].success({ statusCode: 422, data: {} });
    await expect(first).rejects.toMatchObject({ status: 422 });
    expect(editor.uncertain).toBe(false);
    expect(draft).toEqual(draftFromWear(record));
    const next = editor.save({ ...draft, garmentIds: [secondId] });
    expect(calls[1].header['Idempotency-Key']).not.toBe(calls[0].header['Idempotency-Key']);
    success(calls[1], { id: recordId, version: 1 });
    await next;
  });
  it('reconciles a lost PATCH response before retry and retains the original edit version', async () => {
    const editor = new WearEditor(getAuthSession()!, record);
    const draft = { ...draftFromWear(record), wearDate: '2020-01-02' };
    const first = editor.save(draft);
    expect(calls[0].data?.expected_version).toBe(1);
    calls[0].fail();
    await expect(first).rejects.toThrow();
    const retry = editor.save(draft);
    expect(calls[1].method).toBe('GET');
    success(calls[1], { ...record, wear_date: '2020-01-02', version: 2 });
    await expect(retry).resolves.toEqual({ id: recordId, version: 2 });
    expect(calls).toHaveLength(2);
    const conflictEditor = new WearEditor(getAuthSession()!, record);
    const attempt = conflictEditor.save(draft);
    calls[2].fail();
    await expect(attempt).rejects.toThrow();
    const conflict = conflictEditor.save(draft);
    success(calls[3], { ...record, version: 3 });
    await expect(conflict).rejects.toMatchObject({ status: 409 });
    const staleSave = conflictEditor.save(draft);
    expect(calls[4].data?.expected_version).toBe(1);
    calls[4].success({ statusCode: 409, data: {} });
    await expect(staleSave).rejects.toMatchObject({ status: 409 });
    expect(draft.wearDate).toBe('2020-01-02');
  });
  it.each(['session', 'signal'] as const)(
    'refuses a matching recovery GET resolved immediately before %s changes',
    async (change) => {
      const controller = new AbortController();
      const editor = new WearEditor(getAuthSession()!, record);
      const draft = { ...draftFromWear(record), wearDate: '2020-01-02' };
      const first = editor.save(draft, controller.signal);
      calls[0].fail();
      await expect(first).rejects.toMatchObject({ kind: 'network' });
      const retry = editor.save(draft, controller.signal);
      expect(calls[1].method).toBe('GET');
      // 同一同步栈先 resolve，再切号/abort，故请求层的 success 已退订监听。
      success(calls[1], { ...record, wear_date: draft.wearDate, version: 2 });
      if (change === 'session') saveAuthSession('new-owner', 2);
      else controller.abort();
      await expect(retry).rejects.toMatchObject({ name: 'AbortError' });
      expect(editor.saved).toBe(false);
      expect(calls).toHaveLength(2);
    },
  );

  it('sends DELETE version in the query, preserves retry identity and rejects a late old-session receipt', async () => {
    const first = wearApi.remove(recordId, 2);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toContain('?expected_version=2');
    expect(calls[0].data).toBeUndefined();
    calls[0].fail();
    await expect(first).rejects.toMatchObject({ kind: 'network' });
    const retry = wearApi.remove(recordId, 2);
    expect(calls[1].url).toBe(calls[0].url);
    success(calls[1], { id: recordId, deleted: true });
    await retry;
    const editor = new WearEditor(getAuthSession()!);
    const old = editor.save(draftFromWear(record));
    saveAuthSession('second-owner', 2);
    success(calls[2], { id: recordId, version: 1 });
    await expect(old).rejects.toMatchObject({ name: 'AbortError' });
    expect(editor.saved).toBe(false);
    expect(abort).toHaveBeenCalled();
    await expect(editor.save(draftFromWear(record))).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('real query observers and affected consumers', () => {
  it('loads all garment statuses and starts a fresh cursor when the selection category changes', async () => {
    const observer = new InfiniteQueryObserver(
      queryClient,
      garmentListQueryOptions(getAuthSession(), {}),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    expect(calls[0].url).not.toContain('status=');
    success(calls[0], { items: [{ ...garment, status: 'archived' }], next_cursor: 'page2' });
    await vi.waitFor(() => expect(observer.getCurrentResult().hasNextPage).toBe(true));
    const more = observer.fetchNextPage();
    expect(calls[1].url).toContain('cursor=page2');
    success(calls[1], {
      items: [{ ...garment, id: secondId, status: 'unavailable' }],
      next_cursor: null,
    });
    await more;
    expect(
      observer
        .getCurrentResult()
        .data?.pages.flatMap((page) => page.items)
        .map((item) => item.status),
    ).toEqual(['archived', 'unavailable']);
    observer.setOptions(garmentListQueryOptions(getAuthSession(), { category: 'tops' }));
    expect(calls[2].url).toContain('category=tops');
    expect(calls[2].url).not.toContain('cursor=');
    success(calls[2], { items: [], next_cursor: null });
    await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false));
    unsubscribe();
  });
  it('isolates date filter pages and ignores the cancelled old range response', async () => {
    const observer = new InfiniteQueryObserver(
      queryClient,
      wearListQueryOptions(getAuthSession(), { start_date: '2020-01-01' }),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    observer.setOptions(
      wearListQueryOptions(getAuthSession(), { start_date: '2020-02-01', end_date: '2020-02-29' }),
    );
    expect(calls[1].url).toContain('start_date=2020-02-01');
    expect(calls[1].url).not.toContain('cursor=');
    success(calls[1], { items: [], next_cursor: null });
    success(calls[0], { items: [record], next_cursor: 'old' });
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.pages[0].items).toEqual([]));
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
    expect(abort).toHaveBeenCalled();
    unsubscribe();
  });
  it('keeps detail count while status PATCH re-reads and refreshes it after history changes', async () => {
    const session = getAuthSession()!;
    const observer = new QueryObserver<GarmentDetail>(queryClient, {
      queryKey: sessionQueryKey(session, 'garment', garmentId),
      queryFn: ({ signal }) => wardrobeApi.garment(garmentId, signal),
      initialData: { ...garment, wear_count: 4 },
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const patch = changeGarmentStatus(session, garment, 'archived');
    success(calls[0], { ...garment, status: 'archived', version: 2 });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(observer.getCurrentResult().data?.wear_count).toBe(4);
    success(calls[1], { ...garment, status: 'archived', version: 2, wear_count: 4 });
    await patch;
    const refreshed = invalidateWearFacts(session);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    success(calls[2], { ...garment, status: 'archived', version: 2, wear_count: 3 });
    await refreshed;
    expect(observer.getCurrentResult().data?.wear_count).toBe(3);
    expect(observer.getCurrentResult().data?.status).toBe('archived');
    unsubscribe();
  });
  it('invalidates only the current account fact consumers and a stale writer cannot invalidate a new session', async () => {
    const session = getAuthSession()!;
    const key = sessionQueryKey(session, 'wear-records');
    queryClient.setQueryData(key, [record]);
    for (const domain of ['wear-record', 'garment', 'statistics', 'recommendations'])
      queryClient.setQueryData(sessionQueryKey(session, domain), {});
    await invalidateWearFacts(session);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    saveAuthSession('new-session', 2);
    const newKey = sessionQueryKey(getAuthSession(), 'wear-records');
    queryClient.setQueryData(newKey, []);
    await invalidateWearFacts(session);
    expect(queryClient.getQueryState(newKey)?.isInvalidated).toBe(false);
  });
});
