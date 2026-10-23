import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';
import {
  parsePreferences,
  preferencesApi,
  preferencesInput,
  draftFromPreferences,
  type Preferences,
} from '../src/features/wardrobe-preferences/api';
import {
  emptyPreferencesDraft,
  togglePreference,
  validatePreferencesDraft,
} from '../src/features/wardrobe-preferences/draft';
import { PreferencesEditor } from '../src/features/wardrobe-preferences/editor';
import {
  preferencesQueryOptions,
  refreshPreferences,
} from '../src/features/wardrobe-preferences/queries';
import { returnAfterPreferencesSave } from '../src/features/wardrobe-preferences/navigation';
import type { WardrobeOptions } from '../src/features/wardrobe/api';

const options: WardrobeOptions = {
  version: 'v1',
  categories: [],
  seasons: [],
  colors: [
    { id: 'blue', label: '蓝色' },
    { id: 'red', label: '红色' },
  ],
  styles: [{ id: 'casual', label: '休闲' }],
  occasions: [{ id: 'office', label: '通勤' }],
};
const empty: Preferences = {
  version: 0,
  catalog_version: 'v1',
  liked_styles: [],
  avoided_styles: [],
  liked_colors: [],
  avoided_colors: [],
  liked_occasions: [],
  avoided_occasions: [],
  comfort_notes: null,
};
type Call = {
  method: string;
  url: string;
  data: unknown;
  header: Record<string, string>;
  success: (value: { statusCode: number; data: unknown }) => void;
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
  saveAuthSession('preferences-token', 1);
  calls = [];
  abort = vi.fn();
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return Object.assign(new Promise(() => {}), { abort });
  });
  Taro.navigateBack.mockResolvedValue({});
  Taro.redirectTo.mockResolvedValue({});
});
describe('preferences provider and draft', () => {
  it('requires the full generated response, zero version and nullable notes without inventing defaults', () => {
    expect(parsePreferences(empty)).toEqual(empty);
    for (const value of [
      { ...empty, liked_colors: undefined },
      { ...empty, version: '0' },
      { ...empty, version: -1 },
      { ...empty, comfort_notes: undefined },
      { ...empty, comfort_notes: '  ' },
      { ...empty, liked_colors: ['blue', 'blue'] },
      { ...empty, liked_colors: ['blue'], avoided_colors: ['blue'] },
    ])
      expect(() => parsePreferences(value)).toThrow();
    expect(parsePreferences({ ...empty, comfort_notes: '原文补充' }).comfort_notes).toBe(
      '原文补充',
    );
  });
  it('preserves both sides of all three intersections and allows full clearing', () => {
    let draft = emptyPreferencesDraft();
    for (const [liked, avoided, id] of [
      ['likedStyles', 'avoidedStyles', 'casual'],
      ['likedColors', 'avoidedColors', 'blue'],
      ['likedOccasions', 'avoidedOccasions', 'office'],
    ] as const) {
      draft = togglePreference(togglePreference(draft, liked, id), avoided, id);
      const errors = validatePreferencesDraft(draft, options);
      expect(errors[liked]).toContain('不能同时');
      expect(errors[avoided]).toContain('不能同时');
      expect(draft[liked]).toContain(id);
      expect(draft[avoided]).toContain(id);
    }
    expect(validatePreferencesDraft(emptyPreferencesDraft(), options)).toEqual({});
    expect(
      validatePreferencesDraft(
        { ...emptyPreferencesDraft(), likedStyles: ['unknown'], comfortNotes: 'a'.repeat(501) },
        options,
      ),
    ).toHaveProperty('comfortNotes');
    expect(
      validatePreferencesDraft({ ...emptyPreferencesDraft(), likedStyles: ['unknown'] }, options),
    ).toHaveProperty('likedStyles');
  });
  it('canonicalizes set order and whitespace only at the complete PUT boundary', async () => {
    const draft = {
      ...emptyPreferencesDraft(),
      likedColors: ['red', 'blue', 'red'],
      comfortNotes: '  怕冷，原文保留  ',
    };
    const input = preferencesInput(draft, 0);
    expect(input).toEqual({
      expected_version: 0,
      liked_styles: [],
      avoided_styles: [],
      liked_colors: ['blue', 'red'],
      avoided_colors: [],
      liked_occasions: [],
      avoided_occasions: [],
      comfort_notes: '怕冷，原文保留',
    });
    expect(draft.comfortNotes).toBe('  怕冷，原文保留  ');
    const pending = preferencesApi.save(input);
    expect(calls[0]).toMatchObject({
      method: 'PUT',
      url: 'https://api.example.test/api/v1/preferences',
      data: input,
    });
    expect(calls[0].header.Authorization).toBe('Bearer preferences-token');
    success(calls[0], {
      ...empty,
      version: 1,
      liked_colors: ['blue', 'red'],
      comfort_notes: input.comfort_notes,
    });
    await expect(pending).resolves.toHaveProperty('version', 1);
  });
});
describe('fixed preferences operation', () => {
  it('confirms a lost PUT using newer matching facts and never writes again after completion', async () => {
    const editor = new PreferencesEditor(getAuthSession()!, empty);
    const draft = { ...emptyPreferencesDraft(), likedColors: ['blue'], comfortNotes: '  怕冷  ' };
    const first = editor.save(draft);
    calls[0].fail();
    await expect(first).rejects.toThrow();
    expect(editor.uncertain).toBe(true);
    await expect(editor.save({ ...draft, likedColors: ['red'] })).rejects.toThrow('原操作');
    expect(calls).toHaveLength(1);
    const retry = editor.save(draft);
    expect(calls[1].method).toBe('GET');
    success(calls[1], { ...empty, version: 1, liked_colors: ['blue'], comfort_notes: '怕冷' });
    await expect(retry).resolves.toHaveProperty('version', 1);
    expect(editor.saved).toBe(true);
    await editor.save(draft);
    expect(calls).toHaveLength(2);
  });
  it('retries unchanged same-version facts with the original version and preserves a conflict draft', async () => {
    const initial = { ...empty, version: 3 };
    const draft = draftFromPreferences(initial);
    const original = structuredClone(draft);
    const editor = new PreferencesEditor(getAuthSession()!, initial);
    const first = editor.save(draft);
    calls[0].fail();
    await expect(first).rejects.toThrow();
    const retry = editor.save(draft);
    success(calls[1], initial);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].method).toBe('PUT');
    expect(calls[2].data).toHaveProperty('expected_version', 3);
    calls[2].success({ statusCode: 409, data: { code: 40960, data: null } });
    await expect(retry).rejects.toMatchObject({ status: 409 });
    expect(draft).toEqual(original);
    expect(editor.saved).toBe(false);
  });
  it('never overwrites newer different preferences during unknown-result recovery', async () => {
    const editor = new PreferencesEditor(getAuthSession()!, empty);
    const draft = emptyPreferencesDraft();
    const first = editor.save(draft);
    calls[0].fail();
    await expect(first).rejects.toThrow();
    const retry = editor.save(draft);
    success(calls[1], { ...empty, version: 2, liked_colors: ['red'] });
    await expect(retry).rejects.toMatchObject({ status: 409 });
    expect(calls).toHaveLength(2);
    expect(editor.saved).toBe(false);
    expect(draft).toEqual(emptyPreferencesDraft());
  });
  for (const stage of ['PUT', 'recovery GET'] as const)
    it.each(['switch', 'abort', 'close'] as const)(
      `rejects resolved ${stage} followed in the same synchronous stack by %s`,
      async (action) => {
        const editor = new PreferencesEditor(getAuthSession()!, empty);
        const signal = new AbortController();
        if (stage === 'recovery GET') {
          const failed = editor.save(emptyPreferencesDraft(), signal.signal);
          calls[0].fail();
          await expect(failed).rejects.toThrow();
        }
        const pending = editor.save(emptyPreferencesDraft(), signal.signal);
        success(calls.at(-1)!, { ...empty, version: 1 });
        if (action === 'switch') saveAuthSession('next-account', 2);
        else if (action === 'abort') signal.abort();
        else editor.close();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(editor.saved).toBe(false);
      },
    );
});
describe('preferences query and navigation', () => {
  it('refetches actual observed preferences after save and isolates a new account', async () => {
    const session = getAuthSession()!;
    const observer = new QueryObserver(queryClient, preferencesQueryOptions(session));
    const off = observer.subscribe(() => {});
    success(calls[0], empty);
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.version).toBe(0));
    const editor = new PreferencesEditor(session, empty);
    const save = editor.save({ ...emptyPreferencesDraft(), likedOccasions: ['office'] });
    success(calls.at(-1)!, { ...empty, version: 1, liked_occasions: ['office'] });
    const result = await save;
    const invalidation = refreshPreferences(session, result);
    expect(calls.at(-1)!.method).toBe('GET');
    success(calls.at(-1)!, result);
    await invalidation;
    expect(observer.getCurrentResult().data?.liked_occasions).toEqual(['office']);
    saveAuthSession('other', 2);
    observer.setOptions(preferencesQueryOptions(getAuthSession()));
    success(calls.at(-1)!, empty);
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.version).toBe(0));
    expect(queryClient.getQueryData(sessionQueryKey(session, 'preferences'))).toBeUndefined();
    off();
  });
  it('cancels in-flight reads on logout and discards a resolved query result after a switch', async () => {
    const session = getAuthSession()!;
    const pending = preferencesApi.read();
    clearAuthToken();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(abort).toHaveBeenCalled();
    saveAuthSession('again', 1);
    const current = getAuthSession()!;
    const options = preferencesQueryOptions(current);
    const controller = new AbortController();
    const reading = options.queryFn!({
      signal: controller.signal,
      queryKey: options.queryKey,
      client: queryClient,
      meta: undefined,
    });
    success(calls.at(-1)!, empty);
    saveAuthSession('other', 2);
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(queryClient.getQueryData(sessionQueryKey(session, 'preferences'))).toBeUndefined();
  });
  it('retries navigation alone after a saved PUT and blocks fallback navigation after a switch', async () => {
    const session = getAuthSession()!;
    const editor = new PreferencesEditor(session, empty);
    const draft = emptyPreferencesDraft();
    const saving = editor.save(draft);
    success(calls[0], { ...empty, version: 1 });
    await saving;
    Taro.navigateBack.mockRejectedValueOnce(new Error('failed'));
    Taro.redirectTo.mockRejectedValueOnce(new Error('failed'));
    await expect(returnAfterPreferencesSave(() => getAuthSession() === session)).rejects.toThrow();
    await editor.save(draft);
    await returnAfterPreferencesSave(() => getAuthSession() === session);
    expect(calls).toHaveLength(1);
    let rejectBack!: (reason: Error) => void;
    Taro.navigateBack.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectBack = reject;
        }),
    );
    const back = returnAfterPreferencesSave(() => getAuthSession() === session);
    saveAuthSession('other', 2);
    rejectBack(new Error('failed'));
    await expect(back).rejects.toMatchObject({ name: 'AbortError' });
    expect(Taro.redirectTo).toHaveBeenCalledTimes(1);
  });
});
