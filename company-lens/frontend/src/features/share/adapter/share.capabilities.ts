import type { ShareCapabilities, SharePlatform } from '../model/share.types';

const PLATFORM_KEYS = ['x', 'reddit', 'telegram'] as const satisfies readonly SharePlatform[];

export function detectShareCapabilities(): ShareCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      canCopy: false,
      canDownload: false,
      canWebShare: false,
      canWebShareFiles: false,
      platforms: { x: false, reddit: false, telegram: false },
    };
  }

  const isMobile = window.matchMedia?.('(max-width: 720px)').matches ?? false;
  const canWebShare = typeof navigator.share === 'function';
  const canShare = typeof navigator.canShare === 'function';
  const file =
    typeof File === 'function'
      ? new File(['share'], 'share.png', { type: 'image/png' })
      : undefined;
  let canWebShareFiles = false;
  if (canWebShare && file && canShare) {
    try {
      canWebShareFiles = navigator.canShare({ files: [file] });
    } catch {
      canWebShareFiles = false;
    }
  }

  return {
    isMobile,
    canCopy: typeof navigator.clipboard?.writeText === 'function',
    canDownload: typeof document !== 'undefined',
    canWebShare,
    canWebShareFiles,
    platforms: Object.fromEntries(
      PLATFORM_KEYS.map((platform) => [platform, !isMobile]),
    ) as Readonly<Record<SharePlatform, boolean>>,
  };
}
