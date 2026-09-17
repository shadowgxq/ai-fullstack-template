export const COMPANY_RESEARCH_ERROR_CODES = [
  'not-found',
  'unauthorized',
  'forbidden',
  'retry-not-allowed',
  'report-retry-not-allowed',
  'report-retry-conflict',
  'report-retry-failed',
  'contract-invalid',
  'contract-unavailable',
  'request-failed',
] as const;

export type CompanyResearchErrorCode = (typeof COMPANY_RESEARCH_ERROR_CODES)[number];

export class CompanyResearchError extends Error {
  readonly code: CompanyResearchErrorCode;
  readonly status?: number;
  readonly apiCode?: string | number;
  readonly errorCode?: string;
  readonly details?: unknown;

  constructor(
    code: CompanyResearchErrorCode,
    message: string,
    options?: { status?: number; apiCode?: string | number; errorCode?: string; details?: unknown },
  ) {
    super(message);
    this.name = 'CompanyResearchError';
    this.code = code;
    this.status = options?.status;
    this.apiCode = options?.apiCode;
    this.errorCode = options?.errorCode;
    this.details = options?.details;
  }
}

export function isCompanyResearchErrorCode(
  error: unknown,
  code: CompanyResearchErrorCode,
): error is CompanyResearchError {
  return error instanceof CompanyResearchError && error.code === code;
}
