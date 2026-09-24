/**
 * 埋点的唯一出口。页面只能拿到这几样，`umamiTrack` / `umamiIdentify` /
 * `injectTracker` 一律不出模块——页面拿不到 window.umami 的直接入口，
 * 事件名与公共属性才收得住。
 *
 * startAnalytics / syncIdentity 只给 app 层的 AnalyticsProvider 用。
 */
export { resetIdentityCache, startAnalytics, syncIdentity, trackEvent } from './analytics';
export { EVENTS } from './events';
export { useImpression } from './useImpression';
export type { AnalyticsEventName, EventPayloads } from './events';
