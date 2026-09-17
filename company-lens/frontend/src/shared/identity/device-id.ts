/**
 * 匿名设备标识（device id）。
 *
 * 目的：保证未登录用户也能使用——研究项目与研究记录先按 device id 归属；
 * 用户登录后由后端把匿名数据认领/合并到账号（后续阶段）。
 *
 * 约定：
 * - 首次访问生成一次并持久化到 localStorage，后续复用同一个 id。
 * - localStorage 不可用（隐私模式/被禁用）时退化为进程内 id，本次会话仍可用。
 * - 通过 `DEVICE_ID_HEADER` 随每个请求下发（见 shared/api/requestClient）。
 */

/** localStorage 持久化键。 */
export const DEVICE_ID_STORAGE_KEY = 'sa.device-id';

/** 随请求下发、供后端识别匿名设备的头名；后端契约确认后再对齐。 */
export const DEVICE_ID_HEADER = 'X-Device-Id';

const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

function createDeviceId(): string {
  const cryptoRef: Crypto | undefined = globalThis.crypto;

  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  // Fallback: RFC 4122 v4 from getRandomValues, or Math.random as last resort.
  const bytes = new Uint8Array(16);
  if (typeof cryptoRef?.getRandomValues === 'function') {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function readStoredDeviceId(): string | null {
  try {
    const stored = globalThis.localStorage?.getItem(DEVICE_ID_STORAGE_KEY);
    return isValidDeviceId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistDeviceId(deviceId: string): void {
  try {
    globalThis.localStorage?.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  } catch {
    // localStorage 不可用：本次会话使用进程内 id，不阻断使用。
  }
}

let cachedDeviceId: string | null = null;

/** 返回稳定的匿名设备 id；首次调用生成并持久化，后续复用。 */
export function getDeviceId(): string {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  const existing = readStoredDeviceId();
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }

  const created = createDeviceId();
  persistDeviceId(created);
  cachedDeviceId = created;
  return created;
}

/** 仅供测试：清除进程内缓存（不清除持久化值），用于模拟刷新/重开。 */
export function resetDeviceIdCache(): void {
  cachedDeviceId = null;
}
