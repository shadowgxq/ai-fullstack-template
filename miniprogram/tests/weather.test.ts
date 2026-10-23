import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import Taro from './taro-mock';
import { clearAuthToken, saveAuthSession, getAuthSession } from '../src/shared/api/auth-token';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';
import { CityEditor } from '../src/features/weather/city-editor';
import { CityOperations } from '../src/features/weather/operations';
import {
  parseRegion,
  parseCities,
  parseWeatherContext,
  weatherApi,
} from '../src/features/weather/api';
import { weatherQueryOptions, refreshCityFacts } from '../src/features/weather/queries';
import { resolveCurrentCity } from '../src/features/weather/location';
import { context, region, otherRegion, profile, now } from './weather-fixtures';
type Call = {
  method: string;
  url: string;
  data: unknown;
  header: Record<string, string>;
  success: (value: { statusCode: number; data: unknown }) => void;
  fail: () => void;
};
let calls: Call[];
function success(call: Call, data: unknown) {
  call.success({ statusCode: 200, data: { code: 0, message: 'ok', data } });
}
function failure(call: Call, status: number, code: number) {
  call.success({ statusCode: status, data: { code, message: 'error', data: null } });
}
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('weather-token', 1);
  calls = [];
  vi.spyOn(Date, 'now').mockReturnValue(now);
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return Object.assign(new Promise(() => {}), { abort: vi.fn() });
  });
});
afterEach(() => vi.restoreAllMocks());
describe('city/weather provider contracts', () => {
  it('decodes complete trusted hierarchies and bounded versioned search pages', () => {
    expect(parseRegion(region)).toEqual(region);
    const page = {
      items: [region, otherRegion],
      mapping_version: region.mapping_version,
      next_cursor: null,
    };
    expect(parseCities(page)).toEqual(page);
    for (const broken of [
      { ...region, district: '' },
      { ...region, weather_code: 'bad' },
      { ...region, city_id: '杭州' },
      { ...region, region_id: otherRegion.region_id },
    ])
      expect(() => parseRegion(broken)).toThrow();
    expect(() => parseCities({ ...page, items: [region, region] })).toThrow();
    expect(() => parseCities({ ...page, mapping_version: 'different' })).toThrow();
    expect(() => parseCities({ ...page, items: [], next_cursor: 'not-empty' })).toThrow();
  });
  it('keeps forecast-only/null fields and rejects mixed dates, times and missing-state facts', () => {
    expect(parseWeatherContext(context)).toEqual(context);
    const missing = {
      ...context,
      state: 'missing',
      facts: null,
      missing_reason: 'upstream_unavailable',
    };
    expect(parseWeatherContext(missing)).toEqual(missing);
    const withObservation = {
      ...context,
      facts: {
        ...context.facts!,
        observation: { observed_at: '2026-10-22T09:30:00+08:00', temperature_c: 20 },
      },
    };
    expect(parseWeatherContext(withObservation)).toEqual(withObservation);
    for (const broken of [
      { ...context, facts: undefined },
      { ...context, state: 'missing' },
      { ...context, valid_until: '2026-10-24T00:00:00+08:00' },
      {
        ...context,
        facts: {
          ...context.facts,
          forecast: { ...context.facts!.forecast!, forecast_date: '2026-10-23' },
        },
      },
      {
        ...context,
        facts: {
          ...context.facts,
          observation: { observed_at: '2026-10-21T23:00:00+08:00', temperature_c: 20 },
        },
      },
      { ...context, facts: { ...context.facts, fetched_at: '2026-10-22T07:00:00+08:00' } },
    ])
      expect(() => parseWeatherContext(broken)).toThrow();
  });
  it('uses authenticated exact routes and keeps city and location inputs separate', async () => {
    const search = weatherApi.cities('朝 阳', 'page-token');
    expect(calls[0].url).toBe(
      'https://api.example.test/api/v1/cities?q=%E6%9C%9D%20%E9%98%B3&cursor=page-token',
    );
    expect(calls[0].header.Authorization).toBe('Bearer weather-token');
    success(calls[0], {
      items: [region],
      mapping_version: region.mapping_version,
      next_cursor: null,
    });
    await search;
    const weather = weatherApi.context({ city_id: region.city_id });
    expect(calls[1]).toMatchObject({ method: 'POST', data: { city_id: region.city_id } });
    success(calls[1], context);
    await weather;
  });
});
describe('profile-versioned city save', () => {
  it('patches only city/version, retains fields and confirms an unknown result before completing', async () => {
    const editor = new CityEditor(getAuthSession()!, profile);
    const first = editor.save(otherRegion.city_id);
    expect(calls[0].data).toEqual({ expected_version: 3, city_id: otherRegion.city_id });
    calls[0].fail();
    await expect(first).rejects.toThrow();
    await expect(editor.save(null)).rejects.toThrow('原城市');
    expect(calls).toHaveLength(1);
    const retry = editor.save(otherRegion.city_id);
    expect(calls[1].method).toBe('GET');
    success(calls[1], { ...profile, version: 4, city_id: otherRegion.city_id });
    await expect(retry).resolves.toHaveProperty('nickname', '保留昵称');
    await editor.save(otherRegion.city_id);
    expect(calls).toHaveLength(2);
  });
  it('retries same-version unknown writes with the original version and never auto-upgrades a conflict', async () => {
    const editor = new CityEditor(getAuthSession()!, profile);
    const first = editor.save(null);
    calls[0].fail();
    await expect(first).rejects.toThrow();
    const retry = editor.save(null);
    success(calls[1], profile);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].data).toEqual({ expected_version: 3, city_id: null });
    failure(calls[2], 409, 40960);
    await expect(retry).rejects.toMatchObject({ status: 409 });
    const latest = editor.readLatest();
    success(calls[3], { ...profile, version: 5 });
    const value = await latest;
    const stillOld = editor.save(null);
    expect(calls[4].data).toHaveProperty('expected_version', 3);
    failure(calls[4], 409, 40960);
    await expect(stillOld).rejects.toThrow();
    editor.acceptLatest(value);
    const rebase = editor.save(null);
    expect(calls[5].data).toEqual({ expected_version: 5, city_id: null });
    success(calls[5], { ...profile, version: 6, city_id: null });
    await expect(rebase).resolves.toHaveProperty('city_id', null);
  });
  it('permits an explicitly confirmed new city after a legacy city 42270 but never hides a network read failure', async () => {
    const editor = new CityEditor(getAuthSession()!, profile);
    const reading = editor.readLatestSelection();
    success(calls[0], { ...profile, version: 4, city_id: 'legacy-city' });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    failure(calls[1], 422, 42270);
    const latest = await reading;
    expect(latest).toMatchObject({
      unverified: true,
      region: null,
      profile: { version: 4, city_id: 'legacy-city' },
    });
    editor.acceptLatest(latest.profile);
    const saving = editor.save(otherRegion.city_id);
    expect(calls[2].data).toEqual({ expected_version: 4, city_id: otherRegion.city_id });
    success(calls[2], { ...profile, version: 5, city_id: otherRegion.city_id });
    await saving;
    const next = new CityEditor(getAuthSession()!, profile);
    const failed = next.readLatestSelection();
    success(calls[3], profile);
    await vi.waitFor(() => expect(calls).toHaveLength(5));
    calls[4].fail();
    await expect(failed).rejects.toMatchObject({ kind: 'network' });
  });
  for (const phase of ['PATCH', 'recovery GET'] as const)
    it.each(['switch', 'abort', 'close'] as const)(
      `drops ${phase} success followed in the same stack by %s`,
      async (action) => {
        const editor = new CityEditor(getAuthSession()!, profile);
        const controller = new AbortController();
        if (phase === 'recovery GET') {
          const lost = editor.save(otherRegion.city_id, controller.signal);
          calls[0].fail();
          await expect(lost).rejects.toThrow();
        }
        const pending = editor.save(otherRegion.city_id, controller.signal);
        success(calls.at(-1)!, { ...profile, version: 4, city_id: otherRegion.city_id });
        if (action === 'switch') saveAuthSession('new', 2);
        else if (action === 'abort') controller.abort();
        else editor.close();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(editor.saved).toBe(false);
      },
    );
});
describe('location/search/weather ownership', () => {
  it('resolves fuzzy coordinates before PATCH and saves a valid location even when weather is missing', async () => {
    Taro.getFuzzyLocation.mockResolvedValue({ latitude: 30, longitude: 120 });
    const operation = new CityOperations(getAuthSession()!).begin('selection');
    const locating = resolveCurrentCity(operation);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].data).toEqual({
      location: { latitude: 30, longitude: 120, coordinate_system: 'gcj02', accuracy: 'fuzzy' },
    });
    success(calls[0], {
      ...context,
      region: otherRegion,
      selection_source: 'location',
      state: 'missing',
      facts: null,
      missing_reason: 'upstream_unavailable',
    });
    const value = await locating;
    expect(value?.region).toEqual(otherRegion);
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
    const editor = new CityEditor(getAuthSession()!, profile);
    const saved = editor.save(value!.region.city_id, operation.signal);
    success(calls[1], { ...profile, version: 4, city_id: otherRegion.city_id });
    await expect(saved).resolves.toHaveProperty('city_id', otherRegion.city_id);
  });
  it('does not update the profile on location refusal and drops a resolved lookup after newer manual intent', async () => {
    Taro.getFuzzyLocation.mockRejectedValueOnce({ errMsg: 'auth deny' });
    const scope = new CityOperations(getAuthSession()!);
    await expect(resolveCurrentCity(scope.begin('selection'))).rejects.toThrow();
    expect(calls).toHaveLength(0);
    Taro.getFuzzyLocation.mockResolvedValueOnce({ latitude: 30, longitude: 120 });
    const lookup = resolveCurrentCity(scope.begin('selection'));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    success(calls[0], { ...context, selection_source: 'location' });
    scope.cancelSelection();
    await expect(lookup).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
  });
  it('invalidates the real weather Observer after city PATCH and never relabels old-region facts', async () => {
    const session = getAuthSession()!;
    const observer = new QueryObserver(
      queryClient,
      weatherQueryOptions(session, region.city_id, context.weather_date),
    );
    const off = observer.subscribe(() => {});
    success(calls[0], context);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.region.city_id).toBe(region.city_id),
    );
    const editor = new CityEditor(session, profile);
    const save = editor.save(otherRegion.city_id);
    success(calls[1], { ...profile, version: 4, city_id: otherRegion.city_id });
    const updated = await save;
    const refresh = refreshCityFacts(session, updated);
    expect(calls[2].method).toBe('POST');
    success(calls[2], { ...context, region: otherRegion });
    await refresh;
    expect(observer.getCurrentResult().data?.region.city_id).toBe(region.city_id);
    observer.setOptions(weatherQueryOptions(session, otherRegion.city_id, context.weather_date));
    success(calls.at(-1)!, { ...context, region: otherRegion });
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.region.city_id).toBe(otherRegion.city_id),
    );
    expect(queryClient.getQueryData(sessionQueryKey(session, 'profile'))).toEqual(updated);
    off();
  });
  it('cancels older search pages on a new query/close and preserves directory errors for explicit retry', async () => {
    const scope = new CityOperations(getAuthSession()!);
    const old = scope.begin('search');
    const before = weatherApi.cities('朝阳', null, old.signal);
    const current = scope.begin('search');
    success(calls[0], {
      items: [region],
      next_cursor: null,
      mapping_version: region.mapping_version,
    });
    await expect(before).rejects.toMatchObject({ name: 'AbortError' });
    const page = weatherApi.cities('上海', null, current.signal);
    success(calls[1], {
      items: [otherRegion],
      next_cursor: null,
      mapping_version: region.mapping_version,
    });
    await expect(page).resolves.toHaveProperty('items', [otherRegion]);
    const cursor = weatherApi.cities('上海', 'old-cursor', current.signal);
    failure(calls[2], 409, 40970);
    await expect(cursor).rejects.toMatchObject({ code: 40970 });
    const closing = weatherApi.cities('上海', null, scope.begin('search').signal);
    scope.close();
    await expect(closing).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects a saved-city mismatch or unexpected selected/location context for the default read', async () => {
    const session = getAuthSession()!;
    const options = weatherQueryOptions(session, otherRegion.city_id, context.weather_date);
    const run = () =>
      options.queryFn!({
        signal: new AbortController().signal,
        queryKey: options.queryKey,
        client: queryClient,
        meta: undefined,
      });
    const mismatch = run();
    success(calls[0], context);
    await expect(mismatch).rejects.toMatchObject({ name: 'AbortError' });
    const wrongSource = run();
    success(calls[1], { ...context, selection_source: 'location' });
    await expect(wrongSource).rejects.toThrow('来源');
    const legacyDefault = run();
    success(calls[2], { ...context, selection_source: 'default' });
    await expect(legacyDefault).resolves.toHaveProperty('selection_source', 'default');
  });
  it('drops old-day contexts and resolved weather after a session switch', async () => {
    const session = getAuthSession()!;
    const options = weatherQueryOptions(session, region.city_id, context.weather_date);
    const run = () =>
      options.queryFn!({
        signal: new AbortController().signal,
        queryKey: options.queryKey,
        client: queryClient,
        meta: undefined,
      });
    const stale = run();
    success(calls[0], {
      ...context,
      weather_date: '2026-10-21',
      valid_until: '2026-10-22T00:00:00+08:00',
      facts: null,
      state: 'missing',
      missing_reason: 'day_changed',
    });
    await expect(stale).rejects.toThrow('日期');
    const switched = run();
    success(calls[1], context);
    saveAuthSession('new', 2);
    await expect(switched).rejects.toMatchObject({ name: 'AbortError' });
  });
});
