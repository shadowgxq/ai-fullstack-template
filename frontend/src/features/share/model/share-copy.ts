import type { SharePlatform } from './share.types';

export const SHARE_COPY_MAX_LENGTH = 120;

function plainText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  if (maxLength <= 1) return '…'.slice(0, maxLength);
  return `${characters
    .slice(0, maxLength - 1)
    .join('')
    .trimEnd()}…`;
}

function uniqueParts(parts: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  return parts
    .map((part) => (part ? plainText(part) : ''))
    .filter((part) => {
      const key = part.toLocaleLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildShareCopy(
  parts: readonly (string | undefined)[],
  maxLength = SHARE_COPY_MAX_LENGTH,
): string {
  return truncate(uniqueParts(parts).join('｜'), maxLength);
}

export function buildShareFullText(parts: readonly (string | undefined)[]): string {
  return uniqueParts(parts).join('\n');
}

export function buildPlatformShareText(
  slogan: string,
  result: string,
  platform: SharePlatform,
): string {
  return uniqueParts([slogan, result]).join(platform === 'reddit' ? ' · ' : '\n');
}

export function buildNativeShareText(slogan: string, result: string): string {
  return truncate(uniqueParts([slogan, result]).join('\n'), 300);
}

export function buildShareTextBundle(
  fullText: string,
  landingUrl?: string,
  imageUrl?: string,
): string {
  return [fullText, landingUrl, imageUrl]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n');
}
