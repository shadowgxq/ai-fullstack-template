/**
 * window.umami 的薄封装。唯一职责是把「脚本可能根本不存在」这件事挡在调用方之外：
 * 广告拦截器会直接干掉 tracker，env 未配时我们自己也不插脚本。
 * 埋点永远不能影响主流程（埋点不得影响主流程），因此这里所有函数都静默失败。
 */

type UmamiGlobal = {
  track?: (name: string, data?: Record<string, unknown>) => void;
  identify?: (data: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    umami?: UmamiGlobal;
  }
}

/**
 * 模块级而非组件内的 ref：React StrictMode 下 effect 会执行两次，
 * 两次挂载共享的是模块作用域，只有放这里才拦得住重复注入——插两个 script 会让
 * 所有事件翻倍。
 */
let injected = false;

export function injectTracker(src: string, websiteId: string): void {
  if (injected) {
    return;
  }
  injected = true;

  // 热更新会保留 DOM 但重置模块状态，再查一次防止插重。
  const existing = document.querySelector(`script[data-website-id="${websiteId}"]`);
  if (existing) {
    if (window.umami) {
      flushPending();
    } else {
      existing.addEventListener('load', flushPending, { once: true });
    }
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = websiteId;
  script.addEventListener('load', flushPending, { once: true });
  document.head.appendChild(script);
}

/**
 * tracker 加载完成前发生的事件。
 *
 * tracker 是 defer 脚本，加载要几秒；而 进页面就发的 view 类
 * 「进页面就发」的事件在挂载那一刻就触发了，此时 window.umami 还不存在。
 * 原实现只给 identify 做了补发、track 直接丢——参考项目没暴露这个问题，是因为
 * 它们的事件全由用户点击触发，那时脚本早加载完了。只要字典里有 view 或曝光类事件，不补发就等于这些指标的分子分母全部丢失。
 *
 * 有上限：脚本被广告拦截器干掉时永远不会 flush，无上限会一直堆到内存里。
 * 超出就丢最早的——埋点不能影响主流程（埋点不得影响主流程）。
 */
const MAX_PENDING_EVENTS = 50;
let pendingEvents: Array<{ name: string; data?: Record<string, unknown> }> = [];

function flushEvents(): void {
  if (pendingEvents.length === 0) {
    return;
  }

  const queued = pendingEvents;
  pendingEvents = [];
  for (const event of queued) {
    sendTrack(event.name, event.data);
  }
}

function sendTrack(name: string, data?: Record<string, unknown>): void {
  try {
    window.umami?.track?.(name, data);
  } catch {
    // 埋点失败不影响主流程，也不重试：Umami 内部走 sendBeacon，重试的边际价值很低。
  }
}

export function umamiTrack(name: string, data?: Record<string, unknown>): void {
  if (!window.umami?.track) {
    pendingEvents.push({ name, data });
    if (pendingEvents.length > MAX_PENDING_EVENTS) {
      pendingEvents.shift();
    }
    return;
  }

  sendTrack(name, data);
}

/**
 * 待补发的公共属性。
 *
 * identify 在 App 挂载时就算好了，而 tracker 是 defer 脚本，那一刻 window.umami
 * 还不存在——直接静默丢掉的话公共属性永远发不出去，症状是后台事件都在、session data
 * 全空。事件没有这个问题：它们由用户点击触发，那时脚本早加载完了。所以只看事件是
 * 发现不了这个坑的，单测也测不出来（测试会把上报层整个 mock 掉）。
 */
let pendingIdentity: Record<string, unknown> | null = null;

function flushIdentity(): void {
  if (!pendingIdentity) {
    return;
  }

  const data = pendingIdentity;
  pendingIdentity = null;
  umamiIdentify(data);
}

/**
 * tracker 就绪后统一补发。身份必须先于事件——session data 是会话级属性，
 * 先发事件的话那几条会缺 user_id。
 */
function flushPending(): void {
  flushIdentity();
  flushEvents();
}

export function umamiIdentify(data: Record<string, unknown>): void {
  if (!window.umami?.identify) {
    pendingIdentity = data;
    return;
  }

  try {
    window.umami.identify(data);
  } catch {
    // 同 umamiTrack：埋点不影响主流程。
  }
}

/** 仅供测试：重置注入标记与待补发的属性。 */
export function resetTrackerInjection(): void {
  injected = false;
  pendingIdentity = null;
  pendingEvents = [];
}
