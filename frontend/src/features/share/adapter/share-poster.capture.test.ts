import { describe, expect, it, vi } from 'vitest';
import { toBlob } from 'html-to-image';
import { captureSharePoster } from './share-poster.capture';
vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));

describe('poster capture', () => {
  it('uses settled element dimensions and propagates the PNG blob', async () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      width: 320,
      height: 160,
    } as DOMRect);
    const blob = new Blob(['png'], { type: 'image/png' });
    vi.mocked(toBlob).mockResolvedValueOnce(blob);
    expect(await captureSharePoster(element)).toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ width: 320, height: 160, pixelRatio: 2 }),
    );
  });
  it('reports empty rasterization results instead of returning a false success', async () => {
    vi.mocked(toBlob).mockResolvedValueOnce(null);
    await expect(captureSharePoster(document.createElement('div'))).rejects.toThrow(
      'Poster PNG could not be created',
    );
  });
});
