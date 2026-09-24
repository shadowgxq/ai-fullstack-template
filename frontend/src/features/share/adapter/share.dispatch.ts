import { ShareError } from '../model/share.errors';
import type { SharePlatform } from '../model/share.types';

export const SHARE_PLATFORM_LIMITS = {
  xTextWeight: 220,
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

function xWeight(character: string): number {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return 0;
  return codePoint > 0xffff ||
    X_WIDE_CHARACTER_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end)
    ? 2
    : 1;
}

function truncateWeighted(text: string, maxWeight: number): string {
  const characters = Array.from(text);
  let weight = 0;
  let output = '';
  for (const [index, character] of characters.entries()) {
    const nextWeight = xWeight(character);
    const needsSuffix = index < characters.length - 1;
    if (weight + nextWeight + (needsSuffix ? xWeight('…') : 0) > maxWeight) {
      return `${output.trimEnd()}…`;
    }
    output += character;
    weight += nextWeight;
  }
  return output;
}

function truncateSingleLine(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const characters = Array.from(normalized);
  return characters.length <= maxLength
    ? normalized
    : `${characters
        .slice(0, maxLength - 1)
        .join('')
        .trimEnd()}…`;
}

function rawPlatformUrl(platform: SharePlatform, text: string, landingUrl: string): string {
  const params = new URLSearchParams();
  switch (platform) {
    case 'x':
      params.set('text', text);
      params.set('url', landingUrl);
      return `https://twitter.com/intent/tweet?${params.toString()}`;
    case 'reddit':
      params.set('url', landingUrl);
      params.set('title', text);
      return `https://www.reddit.com/submit?${params.toString()}`;
    case 'telegram':
      params.set('url', landingUrl);
      params.set('text', text);
      return `https://t.me/share/url?${params.toString()}`;
  }
}

function fitTelegramText(landingUrl: string, text: string): string {
  if (
    rawPlatformUrl('telegram', text, landingUrl).length <=
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
    const candidate = `${characters.slice(0, middle).join('').trimEnd()}…`;
    if (
      rawPlatformUrl('telegram', candidate, landingUrl).length <=
      SHARE_PLATFORM_LIMITS.telegramIntentUrlLength
    ) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

export function fitPlatformShareText(
  platform: SharePlatform,
  landingUrl: string,
  text: string,
): string {
  switch (platform) {
    case 'x':
      return truncateWeighted(text, SHARE_PLATFORM_LIMITS.xTextWeight);
    case 'reddit':
      return truncateSingleLine(text, SHARE_PLATFORM_LIMITS.redditTitleLength);
    case 'telegram':
      return fitTelegramText(landingUrl, text);
  }
}

export function buildPlatformShareUrl(
  platform: SharePlatform,
  text: string,
  landingUrl: string,
): string {
  return rawPlatformUrl(platform, fitPlatformShareText(platform, landingUrl, text), landingUrl);
}

export function openPlatformShareUrl(url: string): void {
  if (typeof window === 'undefined') {
    throw new ShareError('unsupported', 'Platform sharing is unavailable.');
  }
  const popup = window.open('', '_blank');
  if (!popup) throw new ShareError('blocked', 'The platform window was blocked.');
  popup.opener = null;
  popup.location.replace(url);
}

export async function copyShareText(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
    throw new ShareError('unsupported', 'Text clipboard is unavailable.');
  }
  await navigator.clipboard.writeText(value);
}

export async function copyShareImage(file: File): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.clipboard?.write !== 'function' ||
    typeof ClipboardItem !== 'function'
  ) {
    throw new ShareError('unsupported', 'Image clipboard is unavailable.');
  }
  await navigator.clipboard.write([new ClipboardItem({ [file.type || 'image/png']: file })]);
}

export function downloadShareImage(file: File): void {
  if (typeof document === 'undefined') {
    throw new ShareError('unsupported', 'Downloads are unavailable.');
  }
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.name;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function nativeShareContent(
  title: string,
  text: string,
  landingUrl?: string,
  posterFile?: File,
): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    throw new ShareError('unsupported', 'System sharing is unavailable.');
  }

  const textData: ShareData = { title, text, ...(landingUrl ? { url: landingUrl } : {}) };
  const candidates: ShareData[] = posterFile
    ? [{ ...textData, files: [posterFile] }, { title, text, files: [posterFile] }, textData]
    : [textData];
  const shareData =
    typeof navigator.canShare === 'function'
      ? candidates.find((candidate) => {
          try {
            return navigator.canShare(candidate);
          } catch {
            return false;
          }
        })
      : textData;
  if (!shareData) throw new ShareError('unsupported', 'This share payload is not supported.');
  await navigator.share(shareData);
}
