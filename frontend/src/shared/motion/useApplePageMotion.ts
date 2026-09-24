import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

type MotionScopeRef = RefObject<HTMLElement | null>;

/**
 * 为 AppShell 下的页面区块提供轻量的 Apple 风格入场。
 *
 * 只读取主内容下的直接区块，避免把表单、弹窗或业务状态内部的 DOM
 * 绑定到全局选择器；matchMedia 负责 reduced-motion 分支和清理 inline style。
 */
export function useApplePageMotion(scopeRef: MotionScopeRef, motionKey?: string) {
  useLayoutEffect(() => {
    const shell = scopeRef.current;
    const main = shell?.querySelector<HTMLElement>('#main-content');
    if (!main) return undefined;

    const markedBlocks = Array.from(main.querySelectorAll<HTMLElement>('[data-page-motion]'));
    const pageBlocks = (markedBlocks.length > 0 ? markedBlocks : Array.from(main.children)).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (pageBlocks.length === 0) return undefined;

    const media = gsap.matchMedia();
    media.add(
      { all: 'all', reduceMotion: '(prefers-reduced-motion: reduce)' },
      ({ conditions }) => {
        if (conditions?.reduceMotion) return;

        gsap.fromTo(
          pageBlocks,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.08,
            overwrite: 'auto',
            clearProps: 'transform,opacity,visibility',
          },
        );
      },
    );

    return () => media.revert();
  }, [motionKey, scopeRef]);
}
