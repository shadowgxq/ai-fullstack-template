import { runtimeConfig } from '../config';
import { getDeviceId } from '../identity';
import type { AnalyticsEventName, EventPayloads } from './events';
import { injectTracker, umamiIdentify, umamiTrack } from './umami';

/**
 * 埋点对外主入口。页面一律调这里，不直接碰 window.umami，也不自己拼公共属性
 * （页面组件不直接调用埋点 SDK，由本模块统一事件名与公共属性）。
 *
 * 本模块不 import features/*：FSD 里 shared 是最底层。登录态由 app 层的
 * AnalyticsProvider 订阅后调 syncIdentity 传进来。
 */

export function startAnalytics(): void {
  const { enabled, umamiSrc, umamiWebsiteId } = runtimeConfig.analytics;

  if (!enabled || !umamiSrc || !umamiWebsiteId) {
    return;
  }

  injectTracker(umamiSrc, umamiWebsiteId);
}

export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  ...rest: K extends keyof EventPayloads ? [payload: EventPayloads[K]] : []
): void {
  umamiTrack(name, rest[0] as Record<string, unknown> | undefined);
}

/** 上一次上报的身份，避免 auth store 无关字段变更触发重复 identify。 */
let lastIdentity: string | null = null;

/**
 * 同步用户标识。公共属性走 identify 设成会话级 session data，这样属性型点位
 * （data-umami-event）和 JS API 点位都能带上。
 *
 * 注意 session data 是覆盖而非快照：登录那一刻，本次会话登录前的事件也会显示成
 * userId。这对漏斗是好事，但不能靠 logged_in 区分事件发生在登录前还是登录后。
 * 同理，随会话变化的字段（如界面语言）不能放进来。
 */
export function syncIdentity(userId: string | null): void {
  if (!runtimeConfig.analytics.enabled) {
    return;
  }

  const resolvedUserId = userId ?? getDeviceId();
  const loggedIn = userId ? '1' : '0';
  const signature = `${resolvedUserId}|${loggedIn}`;

  if (signature === lastIdentity) {
    return;
  }
  lastIdentity = signature;

  umamiIdentify({ user_id: resolvedUserId, logged_in: loggedIn });
}

/** 仅供测试：清掉身份去重缓存。 */
export function resetIdentityCache(): void {
  lastIdentity = null;
}
