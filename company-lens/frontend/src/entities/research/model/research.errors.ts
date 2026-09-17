export const RESEARCH_ERROR_CODES = [
  'not-found',
  'retry-not-allowed',
  'contract-unavailable',
  'contract-invalid',
  'report-unavailable',
  'unauthorized',
  'forbidden',
  'request-failed',
] as const;

export type ResearchErrorCode = (typeof RESEARCH_ERROR_CODES)[number];

export class ResearchError extends Error {
  readonly code: ResearchErrorCode;
  readonly status?: number;
  readonly apiCode?: string | number;
  readonly errorCode?: string;
  readonly details?: unknown;

  constructor(
    code: ResearchErrorCode,
    message: string,
    options?: { status?: number; apiCode?: string | number; errorCode?: string; details?: unknown },
  ) {
    super(message);
    this.name = 'ResearchError';
    this.code = code;
    this.status = options?.status;
    this.apiCode = options?.apiCode;
    this.errorCode = options?.errorCode;
    this.details = options?.details;
  }
}

export function isResearchError(error: unknown): error is ResearchError {
  return error instanceof ResearchError;
}

export function isResearchErrorCode(
  error: unknown,
  code: ResearchErrorCode,
): error is ResearchError {
  return isResearchError(error) && error.code === code;
}
