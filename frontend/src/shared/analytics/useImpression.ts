import { useEffect, useRef, useState, type RefCallback } from 'react';

import { trackEvent } from './analytics';
import type { AnalyticsEventName, EventPayloads } from './events';

/** 元素露出多少算一次曝光。太低会把「划过屏幕边缘」也算进来，压低后续点击率口径。 */
const VISIBLE_RATIO = 0.5;

/**
 * 曝光埋点。同一元素在同一页面生命周期内**只上报一次**——这是去重的第一道闸。
 *
 * 用 IntersectionObserver 而不是「渲染即上报」：曝光要算的是用户**看到过**哪些模块，
 * 渲染在 DOM 里但一直在首屏之下的内容不该计入，否则「看过率」这类指标恒等于 1。
 * 本模板的前端规范也禁止在 render 期间发埋点。
 *
 * 用法：把返回的 ref 挂到要观测的元素上。
 *
 *   const ref = useImpression(EVENTS.top3View, { list_position: index });
 *   return <li ref={ref}>…</li>;
 */
export function useImpression<K extends AnalyticsEventName>(
  name: K,
  ...rest: K extends keyof EventPayloads ? [payload: EventPayloads[K]] : []
): RefCallback<Element> {
  const payload = rest[0];
  // payload 每次渲染都是新对象字面量，放进 deps 会让 observer 反复重建。
  // 存进 ref，上报时读最新值即可；写入放 effect 而不是 render 期间——
  // render 期间改 ref 违反 react-hooks/refs，且并发渲染下可能写入被丢弃的那次结果。
  const payloadRef = useRef(payload);
  useEffect(() => {
    payloadRef.current = payload;
  });

  /**
   * 节点存 state 而不是 ref：调用方常在 early return 之前调本 hook（hook 不能条件调用），
   * 那一刻要观测的元素还没渲染出来。存 ref 的话 effect 只在挂载跑一次、拿到 null 就
   * 再也不会重试，元素后来出现也观测不到——这是实跑中「页面级曝光事件一条都发不出来」的直接原因。存 state 能让节点挂上时触发重渲染。
   */
  const [node, setNode] = useState<Element | null>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!node || reportedRef.current) return undefined;

    // jsdom 与很老的浏览器没有 IntersectionObserver。埋点不能影响主流程（埋点不得影响主流程），
    // 这种环境直接放弃曝光上报，不做「渲染即上报」的降级——那会污染口径。
    if (typeof IntersectionObserver !== 'function') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible || reportedRef.current) return;

        reportedRef.current = true;
        observer.disconnect();
        (trackEvent as (n: K, p?: unknown) => void)(name, payloadRef.current);
      },
      { threshold: VISIBLE_RATIO },
    );

    observer.observe(node);
    return () => observer.disconnect();
    // name 变了等于换了个事件，重新观测；payload 走 ref 不进 deps。
  }, [name, node]);

  // useState 的 setter 引用稳定，直接当 ref 回调用不会每次渲染都重新挂载。
  return setNode;
}
