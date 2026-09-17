import { ShareError } from '../model/share.errors';

export type CapturePosterOptions = {
  pixelRatio?: number;
  timeoutMs?: number;
};

const CONCLUSION_SHARE_DIMENSIONS = {
  width: 1200,
  height: 675,
} as const;

function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  return Promise.all(
    images.map((image) => {
      const decode = () =>
        typeof image.decode === 'function' ? image.decode().catch(() => undefined) : undefined;
      return new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          image.removeEventListener('load', finish);
          image.removeEventListener('error', finish);
          void Promise.resolve(decode()).finally(resolve);
        };
        if (image.complete) {
          finish();
          return;
        }
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
      });
    }),
  ).then(() => undefined);
}

function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new ShareError('timeout', 'Poster capture timed out.'));
    }, timeoutMs);
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
  return {
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
  };
}

type CaptureTarget = Readonly<{
  element: HTMLElement;
  width: number;
  height: number;
  cleanup: () => void;
}>;

function createCaptureTarget(element: HTMLElement): CaptureTarget {
  const sourceDimensions = getElementDimensions(element);
  const stage = element.ownerDocument.createElement('div');
  const captureElement = element.cloneNode(true) as HTMLElement;

  // Keep the fixed export canvas out of the visible dialog so capture cannot reflow the preview.
  stage.setAttribute('data-share-capture-stage', 'true');
  stage.style.position = 'fixed';
  stage.style.top = '0';
  stage.style.left = '-10000px';
  stage.style.width = `${sourceDimensions.width}px`;
  stage.style.height = `${sourceDimensions.height}px`;
  stage.style.overflow = 'hidden';
  stage.style.pointerEvents = 'none';
  stage.style.contain = 'layout paint';

  captureElement.setAttribute('data-capture-mode', 'true');
  captureElement.setAttribute('aria-hidden', 'true');
  stage.append(captureElement);
  element.ownerDocument.body?.append(stage);

  const isConclusionShare = captureElement.dataset.layout === 'conclusion-share';
  return {
    element: captureElement,
    width: isConclusionShare ? CONCLUSION_SHARE_DIMENSIONS.width : sourceDimensions.width,
    height: isConclusionShare ? CONCLUSION_SHARE_DIMENSIONS.height : sourceDimensions.height,
    cleanup: () => stage.remove(),
  };
}

/**
 * DOM-to-PNG adapter kept behind a dynamic import. It captures the independent poster node
 * with html-to-image, waits for fonts/images, and never serializes the long result page.
 */
export async function capturePoster(
  element: HTMLElement,
  options: CapturePosterOptions = {},
): Promise<Blob> {
  const pixelRatio = Math.min(3, Math.max(2, options.pixelRatio ?? 2));
  const timeoutMs = options.timeoutMs ?? 8000;

  try {
    const captureTarget = createCaptureTarget(element);
    try {
      await waitForNextLayout();
      await waitWithTimeout(
        Promise.all([
          document.fonts?.ready ?? Promise.resolve(),
          waitForImages(captureTarget.element),
        ]).then(() => waitForNextLayout()),
        timeoutMs,
      );
      const { toBlob } = await import('html-to-image');
      return await waitWithTimeout(
        toBlob(captureTarget.element, {
          backgroundColor: getComputedStyle(captureTarget.element).backgroundColor,
          cacheBust: true,
          pixelRatio,
          width: captureTarget.width,
          height: captureTarget.height,
        }).then((value) => {
          if (!value) {
            throw new ShareError('capture-failed', 'Poster PNG could not be created.');
          }
          return value;
        }),
        timeoutMs,
      );
    } finally {
      captureTarget.cleanup();
    }
  } catch (error) {
    if (error instanceof ShareError) {
      throw error;
    }
    throw new ShareError(
      'capture-failed',
      error instanceof Error ? error.message : 'Poster capture failed.',
    );
  }
}
