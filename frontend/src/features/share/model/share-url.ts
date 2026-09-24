export type ShareLandingUrlOptions = Readonly<{
  baseUrl?: string;
  refCode?: string;
  utmSource?: string;
}>;

const PRIVATE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'id_token',
  'idtoken',
  'credential',
  'authorization',
  'session',
  'jwt',
]);

/** Preserve business query parameters, clear hash/private credentials, then add attribution. */
export function buildShareLandingUrl(options: ShareLandingUrlOptions = {}): string | undefined {
  const fallback = typeof window === 'undefined' ? undefined : window.location.href;
  const baseUrl = options.baseUrl?.trim() || fallback;
  if (!baseUrl) return undefined;

  try {
    const url = new URL(baseUrl, fallback);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.hash = '';
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (PRIVATE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
    });
    if (options.refCode?.trim()) url.searchParams.set('ref', options.refCode.trim());
    if (options.utmSource?.trim()) {
      url.searchParams.set('utm_source', options.utmSource.trim());
    }
    return url.toString();
  } catch {
    return undefined;
  }
}
