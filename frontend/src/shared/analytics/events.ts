/**
 * 事件字典。**这是模板骨架，新项目要按自己的业务重写这个文件**，
 * 其余几个文件（umami / analytics / useImpression / index）原样用即可。
 *
 * 三条硬规矩：
 *
 * 1. **事件名一经上线不改。** Umami 里同名即同一事件，改名等于新建事件、
 *    历史数据断裂。所以命名先想清楚再上，不要「先随便写个以后再改」。
 *
 * 2. **payload 逐事件用类型约束，禁止透传整个 DTO。** email、token、password、
 *    验证码一律不进 payload；用户标识只用后端 userId 或 deviceId。
 *    下面 EventPayloads 的写法就是这道闸——没在里面登记的事件不允许带 payload。
 *
 * 3. **命名风格看 `analytics/README.md`。** 仓库默认约定是中文「动作-位置」
 *    （如 `开始研究-首页主CTA`），后台直接可读；但事件与字段成套、字段名天然
 *    英文的项目（daily-stock-opportunities、gold-today）用英文 snake_case。
 *    选哪种都行，**同一个项目内必须统一**，并把选择回写 README 的项目表。
 */

export const EVENTS = {
  // 按自己的业务替换。留两个示例说明「无 payload」和「有 payload」两种写法。
  appOpen: 'app_open',
  ctaClick: 'cta_click',
} as const;

export type AnalyticsEventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * 每个事件的 payload。**没有条目 = 该事件不带 payload，调用时也不允许传**——
 * trackEvent 的重载据此约束，写错会在编译期报错而不是上线后才发现字段名不对。
 */
export type EventPayloads = {
  cta_click: { position: string };
};
