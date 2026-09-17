import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectShareCapabilities } from './share.capabilities';

describe('share capabilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides desktop platform actions on mobile', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });

    expect(detectShareCapabilities()).toMatchObject({
      isMobile: true,
      canWebShare: true,
      platforms: { x: false, reddit: false, telegram: false },
    });
  });

  it('treats a throwing canShare probe as unsupported file sharing', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn(() => {
        throw new TypeError('unsupported share data');
      }),
    });

    expect(detectShareCapabilities()).toMatchObject({
      canWebShare: true,
      canWebShareFiles: false,
    });
  });
});
