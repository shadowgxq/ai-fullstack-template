import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { BackToTop } from './BackToTop';

function renderBackToTop(children: ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>);
}

describe('BackToTop', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows after scrolling down and returns focus to the page main', () => {
    const targetRef = createRef<HTMLElement>();
    renderBackToTop(
      <>
        <main ref={targetRef} tabIndex={-1} />
        <BackToTop label="Back to top" targetRef={targetRef} />
      </>,
    );

    const button = screen.getByTitle('Back to top');
    expect(button).toHaveAttribute('aria-hidden', 'true');

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 481 });
    fireEvent.scroll(window);

    expect(button).toHaveAttribute('aria-hidden', 'false');
    expect(button).toHaveAttribute('tabindex', '0');

    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    fireEvent.click(button);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(targetRef.current).toHaveFocus();
  });

  it('hides again after returning to the top', () => {
    const targetRef = createRef<HTMLElement>();
    renderBackToTop(<BackToTop label="Back to top" targetRef={targetRef} />);

    const button = screen.getByTitle('Back to top');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
    fireEvent.scroll(window);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    fireEvent.scroll(window);

    expect(button).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveAttribute('tabindex', '-1');
  });

  it('uses instant scrolling when reduced motion is enabled', () => {
    const targetRef = createRef<HTMLElement>();
    renderBackToTop(<BackToTop label="Back to top" targetRef={targetRef} />);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
    fireEvent.scroll(window);

    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    fireEvent.click(screen.getByTitle('Back to top'));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
