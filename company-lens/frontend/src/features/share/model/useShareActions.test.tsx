import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setShareCompositionForTest } from '../api/share.composition';
import type { SharePayload } from './share.types';
import { useShareActions } from './useShareActions';
import { capturePoster as capturePosterAdapter } from '../adapter/share-poster.capture';

vi.mock('../adapter/share-poster.capture', () => ({
  capturePoster: vi.fn(),
}));

const payload: SharePayload = {
  subjectKind: 'research-result',
  targetId: 'project-1',
  projectId: 'project-1',
  title: 'Research result',
  slogan: 'Research with evidence.',
  result: 'Conclusion',
  fullText: 'Research with evidence.\nConclusion',
  fileName: 'research.png',
  landingCapability: 'project',
  productEntry: 'https://app.example.test',
  poster: {
    title: 'Research result',
    productEntry: 'https://app.example.test',
  },
};

const originalUrl = window.location.href;
const originalClipboard = navigator.clipboard;

describe('useShareActions', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:preview-1'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    setShareCompositionForTest(undefined);
    window.history.replaceState({}, '', originalUrl);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('reuses the captured blob for upload and releases the preview on payload change', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    vi.mocked(capturePosterAdapter).mockResolvedValue(blob);
    const upload = vi.fn().mockResolvedValue({
      assetId: 'mock://share-images/0001',
      fileName: 'research.png',
      blob,
      isDevelopmentMarker: true,
    });
    setShareCompositionForTest({
      imageUploadAdapter: { upload },
    });

    const hook = renderHook(({ currentPayload }) => useShareActions(currentPayload), {
      initialProps: { currentPayload: payload },
    });
    const target = document.createElement('div');

    await act(async () => {
      await hook.result.current.capturePoster(target);
    });
    expect(hook.result.current.captureState).toMatchObject({ status: 'ready', value: blob });

    await act(async () => {
      await hook.result.current.uploadImage();
    });
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ blob, fileName: 'research.png', targetId: 'project-1' }),
    );

    hook.rerender({ currentPayload: { ...payload, targetId: 'project-2' } });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    hook.unmount();
  });

  it('prepares a local poster without automatically uploading it', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const upload = vi.fn().mockResolvedValue({
      assetId: 'mock://share-images/0002',
      fileName: 'research.png',
      blob,
      isDevelopmentMarker: true,
    });
    vi.mocked(capturePosterAdapter).mockResolvedValue(blob);
    setShareCompositionForTest({
      imageUploadAdapter: { upload },
    });

    const hook = renderHook(() => useShareActions(payload));

    await act(async () => {
      await hook.result.current.preparePoster(document.createElement('div'));
    });

    expect(capturePosterAdapter).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    expect(hook.result.current.previewUrl).toBe('blob:preview-1');
    expect(hook.result.current.captureState).toMatchObject({ status: 'ready', value: blob });
    expect(hook.result.current.uploadState.status).toBe('idle');
    expect(hook.result.current.feedback).toBeUndefined();
  });

  it('does not upload when automatic poster capture fails', async () => {
    const upload = vi.fn();
    vi.mocked(capturePosterAdapter).mockRejectedValue(new Error('capture failed'));
    setShareCompositionForTest({
      imageUploadAdapter: { upload },
    });

    const hook = renderHook(() => useShareActions(payload));

    await act(async () => {
      await hook.result.current.preparePoster(document.createElement('div'));
    });

    expect(upload).not.toHaveBeenCalled();
    expect(hook.result.current.captureState.status).toBe('error');
    expect(hook.result.current.uploadState.status).toBe('idle');
  });

  it('ignores a capture that resolves after the payload changes', async () => {
    let resolveCapture: ((blob: Blob) => void) | undefined;
    vi.mocked(capturePosterAdapter).mockReturnValue(
      new Promise((resolve) => {
        resolveCapture = resolve;
      }),
    );
    setShareCompositionForTest({
      imageUploadAdapter: { upload: vi.fn() },
    });
    const hook = renderHook(({ currentPayload }) => useShareActions(currentPayload), {
      initialProps: { currentPayload: payload },
    });
    const capturePromise = hook.result.current.capturePoster(document.createElement('div'));

    hook.rerender({ currentPayload: { ...payload, targetId: 'project-2' } });
    await act(async () => {
      resolveCapture?.(new Blob(['old'], { type: 'image/png' }));
      await capturePromise;
    });

    expect(hook.result.current.previewUrl).toBeUndefined();
    expect(hook.result.current.captureState.status).toBe('idle');
    expect(hook.result.current.uploadState.status).toBe('idle');
  });

  it('copies the current page URL without creating a public snapshot', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    window.history.replaceState({}, '', '/research/project-1/result?market=US#research-conclusion');
    const hook = renderHook(() => useShareActions(payload));

    await act(async () => {
      await hook.result.current.copyLink();
    });

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/research/project-1/result?market=US`,
    );
  });

  it('shares the slogan and result without appending a poster URL to X', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const upload = vi.fn().mockResolvedValue({
      assetId: 'poster-1',
      publicUrl: 'https://files.example.test/shares/research.png',
      fileName: payload.fileName,
      blob,
      isDevelopmentMarker: false,
    });
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: '' },
      opener: window,
    } as unknown as Window;
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.mocked(capturePosterAdapter).mockResolvedValue(blob);
    setShareCompositionForTest({
      imageUploadAdapter: { upload },
    });
    const hook = renderHook(() => useShareActions(payload));

    await act(async () => {
      await hook.result.current.preparePoster(document.createElement('div'));
      await hook.result.current.sharePlatform('x');
    });

    expect(upload).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith('', '_blank');
    expect(decodeURIComponent(popup.location.href)).toContain(
      `text=${payload.slogan}\n${payload.result}`,
    );
    expect(popup.location.href).not.toContain('files.example.test');
    expect(decodeURIComponent(popup.location.href)).toContain(`url=${window.location.origin}/`);
    expect(popup.close).not.toHaveBeenCalled();
    openWindow.mockRestore();
  });

  it('uses a single-line slogan and result for Reddit', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const upload = vi.fn().mockResolvedValue({
      assetId: 'poster-2',
      publicUrl: 'https://files.example.test/shares/research.png',
      fileName: payload.fileName,
      blob,
      isDevelopmentMarker: false,
    });
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: '' },
      opener: window,
    } as unknown as Window;
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.mocked(capturePosterAdapter).mockResolvedValue(blob);
    setShareCompositionForTest({
      imageUploadAdapter: { upload },
    });
    const hook = renderHook(() => useShareActions(payload));

    await act(async () => {
      await hook.result.current.preparePoster(document.createElement('div'));
      await hook.result.current.sharePlatform('reddit');
    });

    expect(upload).not.toHaveBeenCalled();
    expect(decodeURIComponent(popup.location.href)).toContain(
      `title=${payload.slogan} · ${payload.result}`,
    );
    expect(popup.location.href).not.toContain('files.example.test');
    expect(decodeURIComponent(popup.location.href)).toContain(`url=${window.location.origin}/`);
    openWindow.mockRestore();
  });
});
