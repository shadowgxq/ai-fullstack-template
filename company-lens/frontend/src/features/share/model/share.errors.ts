export const SHARE_ERROR_CODES = [
  'unauthorized',
  'request-failed',
  'contract-invalid',
  'capture-failed',
  'upload-failed',
  'unsupported',
  'timeout',
] as const;

export type ShareErrorCode = (typeof SHARE_ERROR_CODES)[number];

export class ShareError extends Error {
  readonly code: ShareErrorCode;
  readonly status?: number;
  readonly apiCode?: string | number;
  readonly errorCode?: string;
  readonly serverMessage?: string;

  constructor(
    code: ShareErrorCode,
    message: string,
    options?: {
      status?: number;
      apiCode?: string | number;
      errorCode?: string;
      serverMessage?: string;
    },
  ) {
    super(message);
    this.name = 'ShareError';
    this.code = code;
    this.status = options?.status;
    this.apiCode = options?.apiCode;
    this.errorCode = options?.errorCode;
    this.serverMessage = options?.serverMessage;
  }
}

export function isShareError(error: unknown): error is ShareError {
  return error instanceof ShareError;
}
