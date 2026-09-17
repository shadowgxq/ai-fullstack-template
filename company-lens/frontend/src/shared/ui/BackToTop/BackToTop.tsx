import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

import styles from './BackToTop.module.css';

const SHOW_AFTER_PX = 480;

export type BackToTopProps = {
  label: string;
  targetRef: RefObject<HTMLElement>;
};

export function BackToTop({ label, targetRef }: BackToTopProps) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityRef = useRef(false);

  useEffect(() => {
    const updateVisibility = () => {
      const nextVisibility = window.scrollY > SHOW_AFTER_PX;
      if (nextVisibility === visibilityRef.current) {
        return;
      }

      visibilityRef.current = nextVisibility;
      setIsVisible(nextVisibility);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateVisibility);
    };
  }, []);

  function handleClick() {
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    targetRef.current?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      className={styles.root}
      data-visible={isVisible}
      aria-hidden={!isVisible}
      aria-label={label}
      title={label}
      tabIndex={isVisible ? 0 : -1}
      onClick={handleClick}
    >
      <ArrowUp size={18} aria-hidden />
    </button>
  );
}
