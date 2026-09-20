import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildShareCopy, buildShareFullText, buildShareTextBundle } from './share-copy';
import { buildShareLandingUrl } from './share-url';
import { normalizeShareError } from './share.errors';
import {
  buildPlatformShareUrl,
  nativeShareContent,
  openPlatformShareUrl,
} from '../adapter/share.dispatch';
import { detectShareCapabilities } from '../adapter/share.capabilities';

afterEach(() => vi.unstubAllGlobals());
describe('public sharing boundary', () => {
  it('removes common credentials, basic auth, and hashes from landing URLs', () => {
    const url = new URL(
      buildShareLandingUrl({
        baseUrl:
          'https://user:secret@example.com/report?token=secret&access_token=secret&api_key=secret&sort=recent#private',
        utmSource: 'demo',
      })!,
    );
    expect(url.username).toBe('');
    expect(url.password).toBe('');
    expect(url.hash).toBe('');
    expect(url.searchParams.get('sort')).toBe('recent');
    expect(url.searchParams.get('utm_source')).toBe('demo');
    expect(url.toString()).not.toContain('secret');
  });
  it('rejects unsafe protocols', () => {
    expect(buildShareLandingUrl({ baseUrl: 'javascript:alert(1)' })).toBeUndefined();
  });
  it('deduplicates plain text and respects Unicode truncation', () => {
    expect(buildShareFullText(['**Title**', 'Title', '[Body](https://example.com)'])).toBe(
      'Title\nBody',
    );
    expect(Array.from(buildShareCopy(['你好世界'], 3))).toHaveLength(3);
    expect(buildShareTextBundle('Summary', 'https://example.com')).toBe(
      'Summary\nhttps://example.com',
    );
  });
  it('encodes intent parameters without allowing payloads to replace the platform origin', () => {
    const url = new URL(
      buildPlatformShareUrl('x', 'Title & query', 'https://example.com/?q=a&b=2'),
    );
    expect(url.origin).toBe('https://twitter.com');
    expect(url.searchParams.get('text')).toBe('Title & query');
    expect(url.searchParams.get('url')).toBe('https://example.com/?q=a&b=2');
  });
  it('reports blocked popups and neutralizes opener for successful ones', () => {
    vi.spyOn(window, 'open').mockReturnValueOnce(null);
    expect(() => openPlatformShareUrl('https://example.com')).toThrow('blocked');
    const popup = { opener: window, location: { replace: vi.fn() } };
    vi.mocked(window.open).mockReturnValue(popup as unknown as Window);
    openPlatformShareUrl('https://example.com');
    expect(popup.opener).toBeNull();
    expect(popup.location.replace).toHaveBeenCalledWith('https://example.com');
  });
  it('does not offer clipboard/system share in insecure contexts', () => {
    vi.stubGlobal('isSecureContext', false);
    expect(detectShareCapabilities()).toMatchObject({
      canWebShare: false,
      canCopyText: false,
      canCopyImage: false,
    });
  });
  it('falls back to text when native file sharing is unavailable', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: (payload: ShareData) => !payload.files });
    await nativeShareContent(
      'Title',
      'Text',
      'https://example.com',
      new File(['image'], 'poster.png', { type: 'image/png' }),
    );
    expect(share).toHaveBeenCalledWith({
      title: 'Title',
      text: 'Text',
      url: 'https://example.com',
    });
  });
  it('treats user cancellation separately from failure', () => {
    expect(normalizeShareError(new DOMException('Cancelled', 'AbortError')).code).toBe('cancelled');
  });
});
