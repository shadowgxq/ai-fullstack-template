import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildPlatformShareUrl,
  nativeShareSharePayload,
  SHARE_PLATFORM_LIMITS,
} from './share.dispatch';

function xTextWeight(text: string): number {
  return Array.from(text).reduce(
    (weight, character) =>
      weight + (/^[\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]$/.test(character) ? 2 : 1),
    0,
  );
}

describe('share dispatch adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the real landing URL when building typed platform links', () => {
    const landingUrl = 'https://share.example.test/project-1?token=raw';
    const url = buildPlatformShareUrl('x', 'A conclusion & risk', landingUrl);

    expect(url).toBe(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent('A conclusion & risk')}&url=${encodeURIComponent(landingUrl)}`,
    );
  });

  it('fits each platform copy to its supported intent boundary', () => {
    const landingUrl = 'https://share.example.test/projects/project-1?ref=share';
    const xUrl = buildPlatformShareUrl('x', `${'行业'.repeat(160)} tail`, landingUrl);
    const redditUrl = buildPlatformShareUrl(
      'reddit',
      `Research result\n${'high-conviction candidate '.repeat(20)}`,
      landingUrl,
    );
    const telegramUrl = buildPlatformShareUrl(
      'telegram',
      'Research result '.repeat(300),
      landingUrl,
    );

    const xText = new URL(xUrl).searchParams.get('text') ?? '';
    const redditTitle = new URL(redditUrl).searchParams.get('title') ?? '';
    const telegramText = new URL(telegramUrl).searchParams.get('text') ?? '';

    expect(xTextWeight(xText)).toBeLessThanOrEqual(SHARE_PLATFORM_LIMITS.xTextWeight);
    expect(xTextWeight(xText) + SHARE_PLATFORM_LIMITS.xUrlWeight).toBeLessThanOrEqual(
      SHARE_PLATFORM_LIMITS.xTotalWeight,
    );
    expect(xText.endsWith('…')).toBe(true);
    expect(redditTitle).not.toMatch(/[\r\n]/);
    expect(Array.from(redditTitle)).toHaveLength(SHARE_PLATFORM_LIMITS.redditTitleLength);
    expect(telegramUrl.length).toBeLessThanOrEqual(SHARE_PLATFORM_LIMITS.telegramIntentUrlLength);
    expect(telegramText.endsWith('…')).toBe(true);
    expect(new URL(telegramUrl).searchParams.get('url')).toBe(landingUrl);
  });

  it('prefers a PNG file when native Web Share supports files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });

    await nativeShareSharePayload(
      'Conclusion',
      'Research',
      'https://share.example.test/project-1',
      new Blob(['png'], { type: 'image/png' }),
      'research.png',
    );

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Research',
        text: 'Conclusion',
        url: 'https://share.example.test/project-1',
        files: [expect.any(File)],
      }),
    );
  });

  it('falls back to text and URL when file support cannot be verified', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });

    await nativeShareSharePayload(
      'Conclusion',
      'Research',
      'https://share.example.test/project-1',
      new Blob(['png'], { type: 'image/png' }),
      'research.png',
    );

    expect(share).toHaveBeenCalledWith({
      title: 'Research',
      text: 'Conclusion',
      url: 'https://share.example.test/project-1',
    });
  });
});
