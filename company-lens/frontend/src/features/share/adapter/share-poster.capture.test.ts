import { beforeEach, describe, expect, it, vi } from 'vitest';

import { capturePoster } from './share-poster.capture';

const toBlob = vi.fn();

vi.mock('html-to-image', () => ({ toBlob }));

describe('capturePoster', () => {
  beforeEach(() => {
    toBlob.mockReset();
  });

  it('captures the independent poster DOM at 2x pixel density', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    let capturedTarget: HTMLElement | undefined;
    toBlob.mockImplementation(async (target: HTMLElement) => {
      capturedTarget = target;
      expect(target).toHaveAttribute('data-capture-mode', 'true');
      return blob;
    });
    const element = document.createElement('div');
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 320, height: 180 }),
    });

    await expect(capturePoster(element)).resolves.toBe(blob);
    expect(capturedTarget).toBeDefined();
    expect(capturedTarget).not.toBe(element);
    expect(toBlob).toHaveBeenCalledWith(
      capturedTarget,
      expect.objectContaining({ height: 180, pixelRatio: 2, width: 320 }),
    );
    expect(element).not.toHaveAttribute('data-capture-mode');
    expect(document.querySelector('[data-share-capture-stage]')).toBeNull();
  });

  it('keeps the conclusion share poster on the reference 1200x675 canvas', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    toBlob.mockResolvedValue(blob);
    const element = document.createElement('div');
    element.dataset.layout = 'conclusion-share';
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 360, height: 203 }),
    });

    await expect(capturePoster(element, { pixelRatio: 3 })).resolves.toBe(blob);
    const capturedTarget = toBlob.mock.calls[0]?.[0] as HTMLElement;
    expect(toBlob).toHaveBeenCalledWith(
      capturedTarget,
      expect.objectContaining({ height: 675, pixelRatio: 3, width: 1200 }),
    );
    expect(capturedTarget).not.toBe(element);
    expect(document.querySelector('[data-share-capture-stage]')).toBeNull();
  });

  it('normalizes an empty renderer result as a capture failure', async () => {
    toBlob.mockResolvedValue(undefined);
    const element = document.createElement('div');

    await expect(capturePoster(element)).rejects.toMatchObject({
      code: 'capture-failed',
      message: 'Poster PNG could not be created.',
    });
    expect(element).not.toHaveAttribute('data-capture-mode');
    expect(document.querySelector('[data-share-capture-stage]')).toBeNull();
  });
});
