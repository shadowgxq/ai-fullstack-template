import type { SharePlatform } from './share.types';

export const SHARE_COPY_MAX_LENGTH = 120;

function plainShareText(value: string): string {
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

function textLength(value: string): number {
  return Array.from(value).length;
}

function truncateText(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return value;
  }
  if (maxLength <= 1) {
    return '…'.slice(0, maxLength);
  }
  return `${characters
    .slice(0, maxLength - 1)
    .join('')
    .trimEnd()}…`;
}

function uniquePlainTextParts(parts: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  return parts
    .map((part) => (part ? plainShareText(part) : ''))
    .filter((part) => {
      const key = part.toLocaleLowerCase();
      if (!part || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function buildShareCopy(
  parts: readonly (string | undefined)[],
  maxLength = SHARE_COPY_MAX_LENGTH,
): string {
  const slogans = uniquePlainTextParts(parts);

  let copy = '';
  for (const slogan of slogans) {
    const separator = copy ? '｜' : '';
    const availableLength = maxLength - textLength(copy) - textLength(separator);
    if (availableLength <= 0) {
      break;
    }
    copy += `${separator}${truncateText(slogan, availableLength)}`;
    if (textLength(slogan) > availableLength) {
      break;
    }
  }
  return copy;
}

/** 复制图文使用的完整文案，和平台短文案保持独立。 */
export function buildShareFullText(parts: readonly (string | undefined)[]): string {
  return uniquePlainTextParts(parts).join('\n');
}

/** 平台正文只由固定 slogan 和当前结果组成。 */
export function buildPlatformShareText(
  slogan: string,
  result: string,
  platform: SharePlatform,
): string {
  const separator = platform === 'reddit' ? ' · ' : '\n';
  return uniquePlainTextParts([slogan, result]).join(separator);
}

export function buildNativeShareText(slogan: string, result: string): string {
  return truncateText(uniquePlainTextParts([slogan, result]).join('\n'), 300);
}

/** 复制内容可在完整文案之后附加落地页和已上传图片地址。 */
export function buildShareTextBundle(
  fullText: string,
  landingUrl?: string,
  imageUrl?: string,
): string {
  return [fullText, landingUrl, imageUrl]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n');
}
