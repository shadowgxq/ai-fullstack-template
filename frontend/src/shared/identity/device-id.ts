/**
 * 匿名访客标识。埋点的 user_id 未登录时用它，登录后换成后端 userId。
 *
 * 本模块刻意不依赖 shared/analytics：它是纯粹的标识，将来匿名请求要带 deviceId 时
 * 直接引这里即可——两边同源才不会出现 UV 口径打架。
 */

/** 新项目改成自己的前缀，避免同域下多个应用互相覆盖。 */
export const DEVICE_ID_STORAGE_KEY = 'app-device-id';

/** localStorage 不可用（隐私模式、被策略禁用）时的回落，保证本次会话内一致。 */
let memoryFallback: string | null = null;

function readStored(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  try {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, value);
  } catch {
    // 写不进去就只靠 memoryFallback，不影响调用方。
  }
}

function createId(): string {
  // randomUUID 要求安全上下文（https / localhost），非安全来源下是 undefined。
  // 埋点标识不需要密码学强度，够唯一即可，因此回落到时间戳 + 随机串。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  const stored = readStored();
  if (stored) {
    return stored;
  }

  if (memoryFallback) {
    return memoryFallback;
  }

  const created = createId();
  memoryFallback = created;
  writeStored(created);

  return created;
}

/** 仅供测试：清掉内存回落，避免用例之间互相污染。 */
export function resetDeviceIdCache(): void {
  memoryFallback = null;
}
