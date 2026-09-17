import { ShareError } from '../model/share.errors';
import type { SharePlatform } from '../model/share.types';

export const SHARE_PLATFORM_LIMITS = {
  /** X allows 280 weighted characters total; keep room for its URL and client variance. */
  xTextWeight: 200,
  xUrlWeight: 23,
  xTotalWeight: 280,
  redditTitleLength: 160,
  telegramIntentUrlLength: 1800,
} as const;

const X_WIDE_CHARACTER_RANGES: readonly [number, number][] = [
  [0x1100, 0x11ff],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7af],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe6f],
  [0xff00, 0xffef],
];

function isWideXCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }
  return (
    codePoint > 0xffff ||
    X_WIDE_CHARACTER_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end)
  );
}

function getXCharacterWeight(character: string): number {
  return isWideXCharacter(character) ? 2 : 1;
}

function truncateWeightedText(text: string, maxWeight: number): string {
  const characters = Array.from(text);
  const suffix = '…';
  const suffixWeight = getXCharacterWeight(suffix);
  let weight = 0;
  let result = '';

  for (const [index, character] of characters.entries()) {
    const characterWeight = getXCharacterWeight(character);
    const hasRemainingCharacters = index < characters.length - 1;
    if (weight + characterWeight + (hasRemainingCharacters ? suffixWeight : 0) > maxWeight) {
      return `${result.trimEnd()}${suffix}`;
    }
    result += character;
    weight += characterWeight;
  }
  return result;
}

function truncateSingleLine(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const characters = Array.from(normalized);
  if (characters.length <= maxLength) {
    return normalized;
  }
  return `${characters
    .slice(0, Math.max(maxLength - 1, 0))
    .join('')
    .trimEnd()}…`;
}

function buildRawPlatformShareUrl(
  platform: SharePlatform,
  text: string,
  landingUrl: string,
): string {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(landingUrl);
  switch (platform) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  }
}

function fitTelegramTextToUrl(url: string, text: string): string {
  if (
    buildRawPlatformShareUrl('telegram', text, url).length <=
    SHARE_PLATFORM_LIMITS.telegramIntentUrlLength
  ) {
    return text;
  }

  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  let best = '';

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = characters.slice(0, middle).join('');
    const candidateWithSuffix = middle < characters.length ? `${candidate.trimEnd()}…` : candidate;
    if (
      buildRawPlatformShareUrl('telegram', candidateWithSuffix, url).length <=
      SHARE_PLATFORM_LIMITS.telegramIntentUrlLength
    ) {
      best = candidateWithSuffix;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

/** 在打开平台入口前应用平台正文预算，URL 始终作为独立参数传递。 */
export function fitPlatformShareText(
  platform: SharePlatform,
  landingUrl: string,
  text: string,
): string {
  switch (platform) {
    case 'x':
      return truncateWeightedText(text, SHARE_PLATFORM_LIMITS.xTextWeight);
    case 'reddit':
      return truncateSingleLine(text, SHARE_PLATFORM_LIMITS.redditTitleLength);
    case 'telegram':
      return fitTelegramTextToUrl(landingUrl, text);
  }
}

export async function copyShareText(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
    throw new ShareError('unsupported', 'Clipboard is unavailable.');
  }
  await navigator.clipboard.writeText(value);
}

export function downloadShareImage(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') {
    throw new ShareError('unsupported', 'Downloads are unavailable.');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function nativeShareSharePayload(
  text: string,
  title: string,
  url: string | undefined,
  blob: Blob | undefined,
  fileName: string,
): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    throw new ShareError('unsupported', 'Native sharing is unavailable.');
  }
  const file =
    blob && typeof File === 'function'
      ? new File([blob], fileName, { type: blob.type || 'image/png' })
      : undefined;
  const textShareData: ShareData = {
    title,
    text,
    ...(url ? { url } : {}),
  };
  const shareCandidates: ShareData[] = file
    ? [
        { ...textShareData, files: [file] },
        { title, text, files: [file] },
        textShareData,
        { title, text },
      ]
    : [textShareData, { title, text }];
  let shareData: ShareData = textShareData;

  if (typeof navigator.canShare === 'function') {
    const supportedShareData = shareCandidates.find((candidate) => {
      try {
        return navigator.canShare(candidate);
      } catch {
        return false;
      }
    });
    if (!supportedShareData) {
      throw new ShareError('unsupported', 'The current share data is unavailable.');
    }
    shareData = supportedShareData;
  }
  await navigator.share(shareData);
}

export function buildPlatformShareUrl(
  platform: SharePlatform,
  text: string,
  landingUrl: string,
): string {
  return buildRawPlatformShareUrl(
    platform,
    fitPlatformShareText(platform, landingUrl, text),
    landingUrl,
  );
}

export function openPendingPlatformWindow(): Window | null {
  if (typeof window === 'undefined') {
    throw new ShareError('unsupported', 'Platform sharing is unavailable.');
  }
  const popup = window.open('', '_blank');
  if (popup) {
    popup.opener = null;
  }
  return popup;
}

export function openPlatformShareUrl(url: string, pendingWindow?: Window | null): void {
  if (typeof window === 'undefined') {
    throw new ShareError('unsupported', 'Platform sharing is unavailable.');
  }
  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.location.href = url;
    return;
  }
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    throw new ShareError('request-failed', 'The platform window was blocked.');
  }
}
