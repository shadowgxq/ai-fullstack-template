export function getCurrentPageShareUrl(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  const url = new URL(window.location.href);
  url.hash = '';
  return url.toString();
}
