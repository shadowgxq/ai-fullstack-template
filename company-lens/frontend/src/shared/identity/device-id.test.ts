import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEVICE_ID_HEADER, DEVICE_ID_STORAGE_KEY, getDeviceId, resetDeviceIdCache } from './device-id';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  resetDeviceIdCache();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('getDeviceId', () => {
  it('generates a valid v4-shaped id and persists it', () => {
    const id = getDeviceId();

    expect(id).toMatch(UUID_V4_PATTERN);
    expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id);
  });

  it('returns the same id across calls', () => {
    expect(getDeviceId()).toBe(getDeviceId());
  });

  it('reuses the persisted id after a reload (cache reset)', () => {
    const first = getDeviceId();

    resetDeviceIdCache();

    expect(getDeviceId()).toBe(first);
  });

  it('ignores an invalid persisted value and regenerates', () => {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'not-a-uuid');
    resetDeviceIdCache();

    const id = getDeviceId();

    expect(id).toMatch(UUID_V4_PATTERN);
    expect(id).not.toBe('not-a-uuid');
  });

  it('still returns a valid id when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    resetDeviceIdCache();

    expect(getDeviceId()).toMatch(UUID_V4_PATTERN);
  });

  it('exposes a stable header name for the backend contract', () => {
    expect(DEVICE_ID_HEADER).toBe('X-Device-Id');
  });
});
