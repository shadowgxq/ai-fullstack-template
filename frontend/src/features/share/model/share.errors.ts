export type ShareErrorCode = 'unsupported' | 'blocked' | 'cancelled' | 'failed';
export class ShareError extends Error {
  readonly code: ShareErrorCode;
  constructor(code: ShareErrorCode, message: string) {
    super(message);
    this.name = 'ShareError';
    this.code = code;
  }
}
export function isShareError(error: unknown): error is ShareError {
  return error instanceof ShareError;
}
export function normalizeShareError(error: unknown): ShareError {
  if (isShareError(error)) return error;
  if (error instanceof DOMException && error.name === 'AbortError')
    return new ShareError('cancelled', 'Sharing was cancelled.');
  return new ShareError('failed', error instanceof Error ? error.message : 'Sharing failed.');
}
