import { beforeEach, describe, expect, it, vi } from 'vitest';

const toBlobMock = vi.hoisted(() => vi.fn());

vi.mock('html-to-image', () => ({ toBlob: toBlobMock }));

import { captureSharePoster } from './share-poster.capture';

describe('captureSharePoster', () => {
  beforeEach(() => {
    toBlobMock.mockReset();
  });

  it('captures the rendered poster element and preserves its source layout', async () => {
    const poster = document.createElement('article');
    const output = new Blob(['poster'], { type: 'image/png' });
    Object.defineProperty(poster, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 320, height: 180 }),
    });
    document.body.append(poster);
    toBlobMock.mockResolvedValue(output);

    await expect(captureSharePoster(poster)).resolves.toBe(output);
    expect(toBlobMock).toHaveBeenCalledWith(
      poster,
      expect.objectContaining({ height: 180, pixelRatio: 2, width: 320 }),
    );
    poster.remove();
  });

  it('returns a capture failure when the renderer returns no blob', async () => {
    const poster = document.createElement('article');
    toBlobMock.mockResolvedValue(null);

    await expect(captureSharePoster(poster)).rejects.toMatchObject({
      code: 'failed',
      message: 'Poster PNG could not be created.',
    });
  });
});
