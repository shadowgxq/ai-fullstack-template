import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import {
  stageRecommendedWear,
  recommendedWearDraft,
  openRecommendedWear,
} from '../src/features/outfits/wear-prefill';
import { OutfitSession } from '../src/features/outfits/session';
import { recommendationApi, type Selection } from '../src/features/outfits/api';
import { WearEditor } from '../src/features/wear-history/editor';
import { draftFromWear, parseWearRecord, wearInput } from '../src/features/wear-history/api';
import { invalidateWearFacts } from '../src/features/wear-history/queries';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';
import { garmentA, requestId, selection, view } from './outfit-fixtures';
type Call = {
  data?: Record<string, unknown>;
  header: Record<string, string>;
  success: (value: { statusCode: number; data: unknown }) => void;
  fail: () => void;
};
let calls: Call[];
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('outfit-wear', 1);
  calls = [];
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return Object.assign(new Promise(() => {}), { abort: vi.fn() });
  });
});
const ok = (call: Call) =>
  call.success({
    statusCode: 200,
    data: { code: 0, message: 'ok', data: { id: requestId, version: 1 } },
  });
describe('recommendation into the existing wear writer', () => {
  it('waits for a fresh full-selection validation before navigating to the same wear form', async () => {
    const client = {
      ...recommendationApi,
      create: vi.fn().mockResolvedValue(view()),
      validate: vi.fn().mockResolvedValue(selection()),
    };
    const store = new OutfitSession(getAuthSession()!, client);
    await store.generate({ scene: 'any', weather_context_id: null });
    await openRecommendedWear(store, () => true);
    expect(client.validate).toHaveBeenCalledWith(requestId, [garmentA.id], expect.anything());
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: expect.stringMatching(/^\/pages\/wear-form\/index\?recommendation=mp-/),
    });
    expect(calls).toHaveLength(0);
    store.close();
  });
  it('does not navigate after the user leaves while confirmation validation is pending', async () => {
    let resolve!: (value: Selection) => void;
    const pending = new Promise<Selection>((yes) => {
      resolve = yes;
    });
    const client = {
      ...recommendationApi,
      create: vi.fn().mockResolvedValue(view()),
      validate: vi.fn().mockReturnValue(pending),
    };
    const store = new OutfitSession(getAuthSession()!, client);
    await store.generate({ scene: 'any', weather_context_id: null });
    let visible = true;
    const opening = openRecommendedWear(store, () => visible);
    visible = false;
    resolve(selection());
    await opening;
    expect(Taro.navigateTo).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    store.close();
  });
  it('stages a session-owned copy with no write; another session cannot restore it', () => {
    const session = getAuthSession()!;
    const key = stageRecommendedWear(session, selection());
    expect(calls).toHaveLength(0);
    const draft = recommendedWearDraft(session, key)!;
    expect(draft.garmentIds).toEqual([garmentA.id]);
    expect(wearInput(draft).recommendation_request_id).toBe(requestId);
    draft.garmentIds.length = 0;
    expect(recommendedWearDraft(session, key)?.garmentIds).toEqual([garmentA.id]);
    saveAuthSession('next-generation', 1);
    expect(recommendedWearDraft(getAuthSession()!, key)).toBeNull();
    expect(recommendedWearDraft(session, key)).toBeNull();
  });
  it('preserves the source and one save key after lost response and only replays completed receipt', async () => {
    const session = getAuthSession()!;
    const key = stageRecommendedWear(session, selection());
    const draft = recommendedWearDraft(session, key)!;
    const editor = new WearEditor(session);
    const saving = editor.save(draft);
    expect(calls[0].data?.recommendation_request_id).toBe(requestId);
    calls[0].fail();
    await expect(saving).rejects.toMatchObject({ kind: 'network' });
    const retry = editor.save(draft);
    expect(calls[1].data).toEqual(calls[0].data);
    expect(calls[1].header['Idempotency-Key']).toBe(calls[0].header['Idempotency-Key']);
    ok(calls[1]);
    await retry;
    await editor.save(draft);
    expect(calls).toHaveLength(2);
  });
  it('keeps source/draft on stale rejection; explicit manual change removes source using a new operation key', async () => {
    const session = getAuthSession()!;
    const draft = recommendedWearDraft(session, stageRecommendedWear(session, selection()))!;
    const original = [...draft.garmentIds];
    const editor = new WearEditor(session);
    const saving = editor.save(draft);
    calls[0].success({
      statusCode: 409,
      data: { code: 40982, message: '推荐依据已变化', data: null },
    });
    await expect(saving).rejects.toMatchObject({ status: 409 });
    expect(draft.recommendationRequestId).toBe(requestId);
    expect(draft.garmentIds).toEqual(original);
    expect(calls).toHaveLength(1);
    const manual = { wearDate: draft.wearDate, garmentIds: [...draft.garmentIds] };
    const next = editor.save(manual);
    expect(calls[1].data).not.toHaveProperty('recommendation_request_id');
    expect(calls[1].header['Idempotency-Key']).not.toBe(calls[0].header['Idempotency-Key']);
    ok(calls[1]);
    await next;
  });
  it('retains the historical source in decoded records while edits stay independent from old recommendations', () => {
    const data = {
      id: requestId,
      version: 2,
      wear_date: '2020-01-01',
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
      recommendation_request_id: requestId,
      items: [{ garment_id: garmentA.id, name_snapshot: '旧名称', category_snapshot: null }],
    };
    const record = parseWearRecord(data);
    expect(record.recommendation_request_id).toBe(requestId);
    expect(wearInput(draftFromWear(record))).not.toHaveProperty('recommendation_request_id');
    expect(() => parseWearRecord({ ...data, recommendation_request_id: 'invalid' })).toThrow();
  });
  it('invalidates true history, count/statistics and recommendation facts only for the current session', async () => {
    const session = getAuthSession()!;
    for (const domain of [
      'wear-records',
      'wear-record',
      'garment',
      'statistics',
      'recommendations',
    ])
      queryClient.setQueryData(sessionQueryKey(session, domain), { value: 1 });
    await invalidateWearFacts(session);
    for (const domain of [
      'wear-records',
      'wear-record',
      'garment',
      'statistics',
      'recommendations',
    ])
      expect(queryClient.getQueryState(sessionQueryKey(session, domain))?.isInvalidated).toBe(true);
    saveAuthSession('new-owner', 2);
    const current = getAuthSession()!;
    queryClient.setQueryData(sessionQueryKey(current, 'recommendations'), { value: 1 });
    await invalidateWearFacts(session);
    expect(
      queryClient.getQueryState(sessionQueryKey(current, 'recommendations'))?.isInvalidated,
    ).toBe(false);
  });
});
