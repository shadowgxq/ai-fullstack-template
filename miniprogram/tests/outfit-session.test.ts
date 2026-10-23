import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { ApiError } from '../src/shared/api/errors';
import { queryClient } from '../src/shared/query/client';
import {
  recommendationApi,
  type Recommendation,
  type Selection,
} from '../src/features/outfits/api';
import { canConfirm, OutfitSession, outfitSession } from '../src/features/outfits/session';
import { garmentA, garmentB, garmentC, requestId, selection, view } from './outfit-fixtures';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const payload = { scene: 'any' as const, weather_context_id: null };
function client() {
  return {
    create: vi.fn<typeof recommendationApi.create>().mockResolvedValue(view()),
    read: vi.fn<typeof recommendationApi.read>().mockResolvedValue(view()),
    cancel: vi
      .fn<typeof recommendationApi.cancel>()
      .mockResolvedValue(view({ status: 'cancelled', outcome: null, result: null })),
    validate: vi.fn<typeof recommendationApi.validate>().mockResolvedValue(selection()),
    candidates: vi.fn<typeof recommendationApi.candidates>(),
  };
}
let sessions: OutfitSession[];
beforeEach(() => {
  vi.clearAllMocks();
  clearAuthToken();
  saveAuthSession('outfit-session', 1);
  sessions = [];
});
afterEach(() => {
  sessions.forEach((s) => s.close());
  queryClient.clear();
  vi.useRealTimers();
});
function setup() {
  const api = client();
  const store = new OutfitSession(getAuthSession()!, api);
  sessions.push(store);
  return { api, store };
}
describe('recommendation identity and lifecycle', () => {
  it('starts a fresh read on return even if the hidden-page read ignores abort and resolves late', async () => {
    const { api, store } = setup();
    api.create.mockResolvedValueOnce(view({ status: 'generating', result: null, outcome: null }));
    await store.generate(payload);
    const old = deferred<Recommendation>();
    api.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(view());
    const first = store.refresh();
    store.setVisible(false);
    store.setVisible(true);
    await Promise.resolve();
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(store.snapshot().view?.status).toBe('ready');
    old.resolve(view({ status: 'generating', result: null, outcome: null }));
    await first;
    expect(store.snapshot().view?.status).toBe('ready');
  });
  it('rechecks day/fact validity only while visible and uses the actual server stale state', async () => {
    const { api, store } = setup();
    await store.generate(payload);
    store.refreshIfVisible();
    expect(api.read).not.toHaveBeenCalled();
    store.setVisible(true);
    await Promise.resolve();
    api.read.mockResolvedValueOnce(
      view({ status: 'stale', result: null, error_code: 'weather_expired' }),
    );
    store.refreshIfVisible();
    await Promise.resolve();
    expect(store.snapshot().view?.status).toBe('stale');
    expect(canConfirm(store.snapshot())).toBe(false);
  });
  it('retains frozen payload/key after unknown create and uses a new key only for a new generation', async () => {
    const { api, store } = setup();
    api.create.mockRejectedValueOnce(new ApiError('网络失败', 'network'));
    await store.generate(payload);
    expect(store.snapshot().uncertain).toBe(true);
    const key = api.create.mock.calls[0][1];
    await store.generate({ scene: 'date', weather_context_id: garmentB.id });
    expect(api.create.mock.calls[1].slice(0, 2)).toEqual([payload, key]);
    expect(canConfirm(store.snapshot())).toBe(true);
    await store.generate(payload);
    expect(api.create.mock.calls[2][1]).not.toBe(key);
  });
  it('preserves one same-session controller and request across hides; only pauses reads', async () => {
    vi.useFakeTimers();
    const { api, store } = setup();
    api.create.mockResolvedValue(view({ status: 'generating', result: null, outcome: null }));
    api.read.mockResolvedValue(view({ status: 'generating', result: null, outcome: null }));
    store.setVisible(true);
    await store.generate(payload);
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.read).toHaveBeenCalledOnce();
    store.setVisible(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.read).toHaveBeenCalledOnce();
    expect(api.cancel).not.toHaveBeenCalled();
    expect(store.snapshot().view?.request_id).toBe(requestId);
    api.read.mockResolvedValueOnce(view());
    store.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(api.create).toHaveBeenCalledOnce();
    expect(canConfirm(store.snapshot())).toBe(true);
    expect(outfitSession(getAuthSession()!)).toBe(outfitSession(getAuthSession()!));
  });
  it('does not auto retry a failed read or create another model request', async () => {
    vi.useFakeTimers();
    const { api, store } = setup();
    api.create.mockResolvedValueOnce(
      view({ status: 'dispatch_pending', outcome: null, result: null }),
    );
    api.read.mockRejectedValueOnce(new ApiError('不可用', 'network'));
    store.setVisible(true);
    await store.generate(payload);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.read).toHaveBeenCalledOnce();
    expect(api.create).toHaveBeenCalledOnce();
    expect(store.snapshot().error).toContain('不可用');
    await store.refresh();
    expect(api.read).toHaveBeenCalledTimes(2);
  });
  it.each(['create', 'read', 'cancel'] as const)(
    'drops late %s results from an old account or generation',
    async (kind) => {
      const { api, store } = setup();
      const late = deferred<Recommendation>();
      if (kind !== 'create') {
        api.create.mockResolvedValueOnce(
          view({ status: 'generating', outcome: null, result: null }),
        );
        await store.generate(payload);
      }
      api[kind].mockReturnValueOnce(late.promise);
      const promise =
        kind === 'create'
          ? store.generate(payload)
          : kind === 'read'
            ? store.refresh()
            : store.cancel();
      const before = store.snapshot().view;
      saveAuthSession('different-user', 2);
      late.resolve(view());
      await promise;
      expect(store.snapshot().view).toBe(before);
      expect(canConfirm(store.snapshot())).toBe(false);
    },
  );
});
describe('cancel and full-selection races', () => {
  it('guards cancellation, drops an older read and never revives a cancelled result', async () => {
    const { api, store } = setup();
    api.create.mockResolvedValueOnce(view({ status: 'generating', outcome: null, result: null }));
    await store.generate(payload);
    const read = deferred<Recommendation>();
    api.read.mockReturnValueOnce(read.promise);
    const refresh = store.refresh();
    const cancellation = deferred<Recommendation>();
    api.cancel.mockReturnValueOnce(cancellation.promise);
    const cancel = store.cancel();
    expect(store.snapshot().cancelling).toBe(true);
    await store.cancel();
    expect(api.cancel).toHaveBeenCalledOnce();
    expect(canConfirm(store.snapshot())).toBe(false);
    cancellation.resolve(view({ status: 'cancelled', outcome: null, result: null }));
    await cancel;
    read.resolve(view());
    await refresh;
    expect(store.snapshot().view?.status).toBe('cancelled');
  });
  it('shows ready if completion won and retains same-request retry when cancel fails', async () => {
    const { api, store } = setup();
    api.create.mockResolvedValueOnce(view({ status: 'generating', outcome: null, result: null }));
    await store.generate(payload);
    api.cancel.mockRejectedValueOnce(new ApiError('取消未确认', 'network'));
    await store.cancel();
    expect(store.snapshot().view?.status).toBe('generating');
    expect(store.snapshot().error).toContain('取消未确认');
    api.cancel.mockResolvedValueOnce(view());
    await store.cancel();
    expect(api.cancel.mock.calls.every((call) => call[0] === requestId)).toBe(true);
    expect(store.snapshot().view?.status).toBe('ready');
    expect(canConfirm(store.snapshot())).toBe(true);
  });
  it('replaces only one slot across categories, hides old reasons and accepts only latest validation', async () => {
    const { api, store } = setup();
    api.create.mockResolvedValueOnce(view({ result: selection([garmentA, garmentB]) }));
    await store.generate(payload);
    const first = deferred<Selection>();
    const second = deferred<Selection>();
    api.validate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const replace1 = store.replace(garmentA.id, garmentC);
    expect(store.snapshot().selectedIds).toEqual([garmentC.id, garmentB.id]);
    expect(store.snapshot().selection).toBeNull();
    expect(canConfirm(store.snapshot())).toBe(false);
    const replace2 = store.replace(garmentC.id, garmentA);
    second.resolve(selection([garmentA, garmentB], ['最新组合依据']));
    await replace2;
    first.resolve(selection([garmentC, garmentB], ['迟到理由']));
    await replace1;
    expect(store.snapshot().selection?.reasons).toEqual(['最新组合依据']);
    expect(store.snapshot().selectedIds).toEqual([garmentA.id, garmentB.id]);
    expect(api.validate.mock.calls[0][1]).toEqual([garmentC.id, garmentB.id]);
  });
  it('keeps failed selection draft, blocks duplicate items and can retry without creating or writing wear', async () => {
    const { api, store } = setup();
    api.create.mockResolvedValueOnce(view({ result: selection([garmentA, garmentB]) }));
    await store.generate(payload);
    await store.replace(garmentA.id, garmentB);
    expect(api.validate).not.toHaveBeenCalled();
    api.validate.mockRejectedValueOnce(new ApiError('依据已变化', 'http', 409, 40982));
    await store.replace(garmentA.id, garmentC);
    expect(store.snapshot().selectedIds).toEqual([garmentC.id, garmentB.id]);
    expect(store.snapshot().selection).toBeNull();
    expect(store.snapshot().view?.status).toBe('ready');
    expect(canConfirm(store.snapshot())).toBe(false);
    api.validate.mockResolvedValueOnce(selection([garmentC, garmentB]));
    await store.validate();
    expect(canConfirm(store.snapshot())).toBe(true);
    expect(api.create).toHaveBeenCalledOnce();
  });
  it('does not restore original model selection on a show refresh after manual replacement', async () => {
    const { api, store } = setup();
    await store.generate(payload);
    api.validate.mockResolvedValueOnce(selection([garmentC]));
    await store.replace(garmentA.id, garmentC);
    await store.refresh();
    expect(store.snapshot().selectedIds).toEqual([garmentC.id]);
    expect(store.snapshot().selection?.selected_ids).toEqual([garmentC.id]);
    api.read.mockResolvedValueOnce(
      view({ status: 'stale', result: null, error_code: 'input_changed' }),
    );
    await store.refresh();
    expect(store.snapshot().selection).toBeNull();
    expect(canConfirm(store.snapshot())).toBe(false);
  });
  it('ignores late selection after switching sessions', async () => {
    const { api, store } = setup();
    await store.generate(payload);
    const late = deferred<Selection>();
    api.validate.mockReturnValueOnce(late.promise);
    const selecting = store.replace(garmentA.id, garmentC);
    saveAuthSession('next-session', 1);
    late.resolve(selection([garmentC]));
    await selecting;
    expect(store.snapshot().selection).toBeNull();
    expect(canConfirm(store.snapshot())).toBe(false);
  });
});
