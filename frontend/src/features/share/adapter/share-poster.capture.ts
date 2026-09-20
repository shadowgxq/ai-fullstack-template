import { ShareError } from '../model/share.errors';
export type CaptureSharePosterOptions = Readonly<{
  pixelRatio?: number;
  timeoutMs?: number;
  width?: number;
  height?: number;
}>;
function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            image.removeEventListener('load', finish);
            image.removeEventListener('error', finish);
            void Promise.resolve()
              .then(() => (typeof image.decode === 'function' ? image.decode() : undefined))
              .catch(() => undefined)
              .finally(resolve);
          };
          if (image.complete) {
            finish();
            return;
          }
          image.addEventListener('load', finish, { once: true });
          image.addEventListener('error', finish, { once: true });
        }),
    ),
  ).then(() => undefined);
}
function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new ShareError('failed', 'Poster capture timed out.')),
      timeoutMs,
    );
    void promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
function waitForNextLayout(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}
function getElementDimensions(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { width: Math.max(1, Math.ceil(rect.width)), height: Math.max(1, Math.ceil(rect.height)) };
}
/** Capture the caller's rendered poster node, after its fonts, images and layout settle. */
export async function captureSharePoster(
  element: HTMLElement,
  options: CaptureSharePosterOptions = {},
): Promise<Blob> {
  const pixelRatio = Math.min(3, Math.max(2, options.pixelRatio ?? 2));
  const timeoutMs = options.timeoutMs ?? 8000;
  try {
    await waitForNextLayout();
    await waitWithTimeout(
      Promise.all([
        element.ownerDocument.fonts?.ready ?? Promise.resolve(),
        waitForImages(element),
      ]).then(() => waitForNextLayout()),
      timeoutMs,
    );
    const sourceDimensions = getElementDimensions(element);
    const outputWidth = options.width ?? sourceDimensions.width;
    const outputHeight = options.height ?? sourceDimensions.height;
    const fitScale = Math.min(
      outputWidth / sourceDimensions.width,
      outputHeight / sourceDimensions.height,
    );
    const { toBlob } = await import('html-to-image');
    const blob = await waitWithTimeout(
      toBlob(element, {
        backgroundColor: getComputedStyle(element).backgroundColor,
        cacheBust: true,
        height: sourceDimensions.height,
        pixelRatio: pixelRatio * fitScale,
        width: sourceDimensions.width,
      }),
      timeoutMs,
    );
    if (!blob) throw new ShareError('failed', 'Poster PNG could not be created.');
    return blob;
  } catch (error) {
    if (error instanceof ShareError) throw error;
    throw new ShareError(
      'failed',
      error instanceof Error ? error.message : 'Poster capture failed.',
    );
  }
}
