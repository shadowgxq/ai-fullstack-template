import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';

type MotionScopeRef = RefObject<HTMLElement | null>;

/** Animate page sections only; reduced motion and cleanup are scoped to the shell. */
export function useApplePageMotion(scopeRef: MotionScopeRef, motionKey?: string) {
  useLayoutEffect(() => {
    const main = scopeRef.current?.querySelector<HTMLElement>('#main-content');
    if (!main) return undefined;
    const marked = Array.from(main.querySelectorAll<HTMLElement>('[data-page-motion]'));
    const sections = (marked.length ? marked : Array.from(main.children)).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (!sections.length) return undefined;
    const media = gsap.matchMedia();
    media.add(
      { all: 'all', reduceMotion: '(prefers-reduced-motion: reduce)' },
      ({ conditions }) => {
        if (conditions?.reduceMotion) return;
        gsap.fromTo(
          sections,
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
