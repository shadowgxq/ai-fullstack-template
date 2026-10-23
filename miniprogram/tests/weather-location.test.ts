import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { clearAuthToken, saveAuthSession, getAuthSession } from '../src/shared/api/auth-token';
import { requestFuzzyLocation } from '../src/shared/platform/fuzzy-location';
import { CityOperations } from '../src/features/weather/operations';
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('city-session', 1);
});
describe('explicit fuzzy location boundary', () => {
  it('only requests GCJ-02 when called and returns bounded coordinates', async () => {
    expect(Taro.getFuzzyLocation).not.toHaveBeenCalled();
    Taro.getFuzzyLocation.mockResolvedValue({ latitude: 30, longitude: 120, errMsg: 'ok' });
    await expect(requestFuzzyLocation()).resolves.toEqual({ latitude: 30, longitude: 120 });
    expect(Taro.getFuzzyLocation).toHaveBeenCalledExactlyOnceWith({ type: 'gcj02' });
  });
  it('distinguishes cancellation, denied permission and invalid coordinates', async () => {
    Taro.getFuzzyLocation.mockRejectedValueOnce({ errMsg: 'getFuzzyLocation:fail cancel' });
    await expect(requestFuzzyLocation()).resolves.toBeNull();
    Taro.getFuzzyLocation.mockRejectedValueOnce({ errMsg: 'getFuzzyLocation:fail auth deny' });
    await expect(requestFuzzyLocation()).rejects.toThrow('手动搜索');
    Taro.getFuzzyLocation.mockResolvedValueOnce({ latitude: 91, longitude: 120 });
    await expect(requestFuzzyLocation()).rejects.toThrow('有效位置');
  });
  it('aborts before requesting or while the uncancellable native result is pending', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestFuzzyLocation(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(Taro.getFuzzyLocation).not.toHaveBeenCalled();
    let resolve!: (value: { latitude: number; longitude: number }) => void;
    Taro.getFuzzyLocation.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const lifetime = new AbortController();
    const pending = requestFuzzyLocation(lifetime.signal);
    lifetime.abort();
    resolve({ latitude: 30, longitude: 120 });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
describe('city operation ownership', () => {
  it('invalidates older search and explicit selection cancellation without losing the active session', () => {
    const scope = new CityOperations(getAuthSession()!);
    const old = scope.begin('search');
    const current = scope.begin('search');
    expect(() => old.check()).toThrow();
    expect(() => current.check()).not.toThrow();
    const location = scope.begin('selection');
    expect(current.signal.aborted).toBe(true);
    scope.cancelSelection();
    expect(() => location.check()).toThrow();
    expect(scope.active()).toBe(true);
  });
  it.each(['close', 'switch'] as const)(
    'rejects every pending channel after %s, including resolved native microtasks',
    async (action) => {
      const scope = new CityOperations(getAuthSession()!);
      const request = scope.begin('selection');
      let resolve!: (value: { latitude: number; longitude: number }) => void;
      Taro.getFuzzyLocation.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const pending = (async () => {
        const result = await requestFuzzyLocation(request.signal);
        request.check();
        return result;
      })();
      resolve({ latitude: 30, longitude: 120 });
      if (action === 'close') scope.close();
      else saveAuthSession('another', 2);
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(scope.active()).toBe(false);
    },
  );
});
