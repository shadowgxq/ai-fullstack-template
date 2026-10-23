import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { clearAuthToken, saveAuthSession } from '../src/shared/api/auth-token';
import {
  parseCandidates,
  parseRecommendation,
  parseSelection,
  recommendationApi,
} from '../src/features/outfits/api';
import { garmentA, garmentB, requestId, selection, view } from './outfit-fixtures';
type Call = {
  url: string;
  method: string;
  data?: unknown;
  header: Record<string, string>;
  success: (value: { statusCode: number; data: unknown }) => void;
  fail: () => void;
};
let calls: Call[];
const success = (call: Call, data: unknown) =>
  call.success({ statusCode: 200, data: { code: 0, message: 'ok', data } });
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('outfit-api', 1);
  calls = [];
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return Object.assign(new Promise(() => {}), { abort: vi.fn() });
  });
});
describe('recommendation provider decoder', () => {
  it('accepts partial single-item, missing facts and distinct normal-empty outcomes', () => {
    expect(parseRecommendation(view()).result?.selected_ids).toEqual([garmentA.id]);
    for (const outcome of ['no_inventory', 'no_candidates'] as const)
      expect(parseRecommendation(view({ outcome, result: null })).outcome).toBe(outcome);
    for (const status of [
      'dispatch_pending',
      'generating',
      'failed',
      'cancelled',
      'stale',
    ] as const)
      expect(parseRecommendation(view({ status, outcome: null, result: null })).status).toBe(
        status,
      );
  });
  it('rejects invalid state shape, identity, counts and fake selection facts', () => {
    const invalid: unknown[] = [
      { ...view(), status: 'completed' },
      { ...view(), scene: 'evening' },
      { ...view(), result: null },
      { ...view(), result: { ...selection(), request_id: garmentA.id } },
      { ...view(), status: 'cancelled' },
      { ...view(), inventory_count: -1 },
      { ...view(), eligible_count: 4 },
      { ...view(), candidate_scope_limited: 'false' },
      { ...view(), created_at: '2026-01-01' },
      { ...view(), limitations: [null] },
    ];
    for (const value of invalid) expect(() => parseRecommendation(value)).toThrow();
    for (const value of [
      { ...selection(), selected_ids: [] },
      { ...selection(), selected_ids: [garmentA.id, garmentA.id] },
      { ...selection(), garments: [garmentB] },
      { ...selection(), garments: [{ ...garmentA, status: 'archived' }] },
      { ...selection(), reasons: [5] },
    ])
      expect(() => parseSelection(value)).toThrow();
  });
  it('rejects invalid, duplicate, oversized or nonwearable candidates', () => {
    expect(parseCandidates({ items: [garmentA], next_cursor: 'cursor/+' }).items[0].id).toBe(
      garmentA.id,
    );
    for (const value of [
      { items: [garmentA, garmentA], next_cursor: null },
      { items: [{ ...garmentA, status: 'unavailable' }], next_cursor: null },
      { items: [], next_cursor: '' },
      { items: [], next_cursor: 'x'.repeat(4097) },
    ])
      expect(() => parseCandidates(value)).toThrow();
  });
});
describe('actual five HTTP consumers', () => {
  it('uses Backend bearer/envelope, stable create key and exact create/cancel/read paths', async () => {
    const payload = { scene: 'work' as const, weather_context_id: null };
    const create = recommendationApi.create(payload, 'fixed-create');
    expect(calls[0].url).toBe('https://api.example.test/api/v1/recommendations');
    expect(calls[0].data).toEqual(payload);
    expect(calls[0].header['Idempotency-Key']).toBe('fixed-create');
    expect(calls[0].header.Authorization).toBe('Bearer outfit-api');
    success(calls[0], view({ scene: 'work' }));
    await create;
    const read = recommendationApi.read(requestId);
    expect(calls[1].url).toBe('https://api.example.test/api/v1/recommendations/' + requestId);
    success(calls[1], view());
    await read;
    const cancel = recommendationApi.cancel(requestId);
    expect(calls[2].method).toBe('POST');
    expect(calls[2].url).toBe(
      'https://api.example.test/api/v1/recommendations/' + requestId + '/cancel',
    );
    success(calls[2], view({ status: 'cancelled', outcome: null, result: null }));
    await cancel;
  });
  it('preserves order of complete selection and verifies response correlation', async () => {
    const ids = [garmentB.id, garmentA.id];
    const promise = recommendationApi.validate(requestId, ids);
    expect(calls[0].data).toEqual({ selected_ids: ids });
    success(calls[0], selection([garmentB, garmentA]));
    await expect(promise).resolves.toMatchObject({ selected_ids: ids });
    const reordered = recommendationApi.validate(requestId, ids);
    success(calls[1], selection([garmentA, garmentB]));
    await expect(reordered).rejects.toMatchObject({ kind: 'invalid-response' });
    const wrong = recommendationApi.read(requestId);
    success(
      calls[2],
      view({ request_id: garmentA.id, result: { ...selection(), request_id: garmentA.id } }),
    );
    await expect(wrong).rejects.toMatchObject({ kind: 'invalid-response' });
  });
  it('encodes repeated exclude IDs and opaque cursors without same-category filters', async () => {
    const promise = recommendationApi.candidates(requestId, [garmentA.id, garmentB.id], 'next/+?');
    expect(calls[0].url).toContain('exclude_ids=' + garmentA.id + '&exclude_ids=' + garmentB.id);
    expect(calls[0].url).toContain('cursor=next%2F%2B%3F');
    expect(calls[0].url).not.toContain('category');
    success(calls[0], { items: [], next_cursor: null });
    await promise;
    const excluded = recommendationApi.candidates(requestId, [garmentA.id], null);
    success(calls[1], { items: [garmentA], next_cursor: null });
    await expect(excluded).rejects.toMatchObject({ kind: 'invalid-response' });
    const looping = recommendationApi.candidates(requestId, [], 'loop');
    success(calls[2], { items: [], next_cursor: 'loop' });
    await expect(looping).rejects.toMatchObject({ kind: 'invalid-response' });
  });
  it('isolates old successful/401 responses after switching accounts', async () => {
    const old = recommendationApi.read(requestId);
    saveAuthSession('new-outfit-user', 2);
    success(calls[0], view());
    await expect(old).rejects.toMatchObject({ name: 'AbortError' });
    const second = recommendationApi.read(requestId);
    saveAuthSession('latest-outfit-user', 3);
    calls[1].success({ statusCode: 401, data: {} });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
  });
});
