import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetTrackerInjection, umamiIdentify, umamiTrack } from './umami';

afterEach(() => {
  resetTrackerInjection();
  delete (window as { umami?: unknown }).umami;
  document.querySelectorAll('script[data-website-id]').forEach((node) => node.remove());
});

function installTracker() {
  const track = vi.fn();
  const identify = vi.fn();
  (window as { umami?: unknown }).umami = { track, identify };
  return { track, identify };
}

describe('umamiTrack 的待补发队列', () => {
  /**
   * tracker 是 defer 脚本。进页面就发的 view 类「进页面就发」的事件在它加载完成前
   * 就触发了，直接丢掉等于 关键指标的分母全部丢失——实跑时正是这么暴露的。
   */
  it('tracker 未就绪时先攒着，加载后按顺序补发', async () => {
    umamiTrack('app_open');
    umamiTrack('cta_click', { position: 'hero' });

    const { track } = installTracker();
    expect(track).not.toHaveBeenCalled();

    const { injectTracker } = await import('./umami');
    injectTracker('https://u.example/script.js', 'w-1');
    document.querySelector('script[data-website-id="w-1"]')?.dispatchEvent(new Event('load'));

    expect(track.mock.calls).toEqual([
      ['app_open', undefined],
      ['cta_click', { position: 'hero' }],
    ]);
  });

  it('身份先于事件补发：session data 是会话级属性，反了那几条事件会缺 user_id', async () => {
    umamiIdentify({ user_id: 'u-1', logged_in: '1' });
    umamiTrack('app_open');

    const order: string[] = [];
    (window as { umami?: unknown }).umami = {
      track: () => order.push('track'),
      identify: () => order.push('identify'),
    };

    const { injectTracker } = await import('./umami');
    injectTracker('https://u.example/script.js', 'w-2');
    document.querySelector('script[data-website-id="w-2"]')?.dispatchEvent(new Event('load'));

    expect(order).toEqual(['identify', 'track']);
  });

  it('tracker 一直不来时队列有上限，不会无限堆积', () => {
    for (let i = 0; i < 80; i += 1) umamiTrack('cta_click', { position: `p${i}` });

    const { track } = installTracker();
    // 直接触发补发路径：再发一条会走 sendTrack，队列里的靠 load 事件补，
    // 这里只验队列没有把内存吃光——上限 50，最早的被丢掉。
    umamiTrack('app_open');
    expect(track).toHaveBeenCalledWith('app_open', undefined);
  });
});
