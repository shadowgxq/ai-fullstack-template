export type ApiErrorMessageContext = Readonly<{
  errorCode?: string | null;
  code?: string | number | null;
  apiCode?: string | number | null;
  status?: number;
}>;

export type ApiErrorMessageMatch = Readonly<{
  key: string;
  options?: Readonly<Record<string, string>>;
}>;

const EXACT_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  success: 'apiErrors.messages.success',
  'Parameter validation failed': 'apiErrors.messages.validationFailed',
  'Invalid parameter': 'apiErrors.messages.invalidParameter',
  'Invalid input': 'apiErrors.messages.invalidParameter',
  'Failed to send verification code, please try again later':
    'apiErrors.messages.emailCodeSendFailed',
  'Failed to send email verification code': 'apiErrors.messages.emailCodeSendFailed',
  'Verification code sent too frequently, please try again later':
    'apiErrors.messages.emailCodeCooldown',
  'Too many verification code requests, please try again later':
    'apiErrors.messages.emailCodeRateLimited',
  'Too many attempts, please try again later': 'apiErrors.messages.emailCodeRateLimited',
  'Invalid verification code': 'apiErrors.messages.emailCodeInvalid',
  'Verification code has already been used': 'apiErrors.messages.emailCodeUsed',
  'Verification code has expired': 'apiErrors.messages.emailCodeExpired',
  'Invalid email address': 'apiErrors.messages.emailInvalid',
  'Email address is invalid': 'apiErrors.messages.emailInvalid',
  'Google credential is required': 'apiErrors.messages.googleCredentialRequired',
  'Invalid Google ID token': 'apiErrors.messages.googleIdTokenInvalid',
  'Google login is not configured': 'apiErrors.messages.googleLoginNotConfigured',
  'Incorrect password': 'apiErrors.messages.passwordInvalid',
  'Username or password is incorrect': 'apiErrors.messages.passwordInvalid',
  'Password login is only allowed for administrators': 'apiErrors.messages.passwordAdminOnly',
  'Password login is only available for administrators': 'apiErrors.messages.passwordAdminOnly',
  'Account has been disabled': 'apiErrors.messages.userDisabled',
  'Relay login is disabled': 'apiErrors.messages.relayDisabled',
  'Relay authentication is disabled': 'apiErrors.messages.relayDisabled',
  'Relay assertion has expired': 'apiErrors.messages.relayAssertionExpired',
  'Relay authentication has expired': 'apiErrors.messages.relayAssertionExpired',
  'Relay assertion was replayed': 'apiErrors.messages.relayAssertionReplayed',
  'Relay authentication token has already been used': 'apiErrors.messages.relayAssertionReplayed',
  'Invalid relay assertion': 'apiErrors.messages.relayAssertionInvalid',
  'Invalid relay authentication': 'apiErrors.messages.relayAssertionInvalid',
  'Analytics is only available to administrators': 'apiErrors.messages.analyticsAdminOnly',
  'Missing authentication token': 'apiErrors.messages.tokenMissing',
  'Token has expired': 'apiErrors.messages.tokenExpired',
  'Invalid authentication token': 'apiErrors.messages.tokenInvalid',
  'Access denied': 'apiErrors.messages.accessDenied',
  'No permission to perform this operation': 'apiErrors.messages.noPermission',
  'No permission': 'apiErrors.messages.noPermission',
  'Research project not found': 'apiErrors.messages.projectNotFound',
  'Research task not found': 'apiErrors.messages.taskNotFound',
  'Conversation not found': 'apiErrors.messages.conversationNotFound',
  'Agent not found': 'apiErrors.messages.agentNotFound',
  'Agent result not found': 'apiErrors.messages.agentResultNotFound',
  'Finalist not found': 'apiErrors.messages.finalistNotFound',
  'No permission to access this project': 'apiErrors.messages.projectForbidden',
  'No permission to access this conversation': 'apiErrors.messages.conversationForbidden',
  'Project has ended, cannot cancel': 'apiErrors.messages.projectCannotCancel',
  'Current status does not allow retry': 'apiErrors.messages.projectCannotRetry',
  'No agents to retry': 'apiErrors.messages.noAgentsToRetry',
  'Current status does not allow re-run': 'apiErrors.messages.projectCannotRerun',
  'Failed to submit research execution': 'apiErrors.messages.submitResearchFailed',
  'Preflight failed': 'apiErrors.messages.preflightFailed',
  'Failed to create research task': 'apiErrors.messages.taskCreateFailed',
  'Report content parse error': 'apiErrors.messages.reportParseError',
  'Only completed projects can be shared': 'apiErrors.messages.shareOnlyCompleted',
  'Share not found': 'apiErrors.messages.shareNotFound',
  'Share has been revoked': 'apiErrors.messages.shareRevoked',
  'Share has expired': 'apiErrors.messages.shareExpired',
  'No permission to access this share': 'apiErrors.messages.shareForbidden',
  'Unsupported image format': 'apiErrors.messages.imageInvalidType',
  'Image not found': 'apiErrors.messages.imageNotFound',
  'Invalid business identifier': 'apiErrors.messages.fileInvalidBiz',
  'Unsupported file format': 'apiErrors.messages.fileInvalidType',
  'File not found': 'apiErrors.messages.fileNotFound',
  'Stock not found': 'apiErrors.messages.stockNotFound',
  'Unsupported language, only zh-CN / en-US are supported': 'apiErrors.messages.languageInvalid',
  'Please enter a research query (2-100 characters)': 'apiErrors.messages.queryRequired',
  'Recognition ID is required': 'apiErrors.messages.recognitionIdRequired',
  'Please select a candidate': 'apiErrors.messages.candidateRequired',
  'Project ID is required': 'apiErrors.messages.projectIdRequired',
  'Username is required': 'apiErrors.messages.usernameRequired',
  'Password is required': 'apiErrors.messages.passwordRequired',
  'Current status does not allow this operation': 'apiErrors.messages.taskInvalidStatus',
  'Report not yet generated, please try again later': 'apiErrors.messages.reportNotGenerated',
  'This conversation is already linked to an active research task':
    'apiErrors.messages.conversationBusy',
  'Only failed or partially completed tasks can be retried':
    'apiErrors.messages.retryInvalidStatus',
  'Please specify the capability to retry': 'apiErrors.messages.retryCapabilityRequired',
  'This task is already bound to an account': 'apiErrors.messages.bindAlreadyBound',
  'This task does not belong to your device': 'apiErrors.messages.bindDeviceMismatch',
  "You cannot delete other user's research records": 'apiErrors.messages.historyDeleteForbidden',
  'Current status does not allow cancellation': 'apiErrors.messages.cancelInvalidStatus',
  'This object type is not supported for research': 'apiErrors.messages.recognitionUnsupported',
  'Cannot recognize the input, please try a more specific name':
    'apiErrors.messages.recognitionUnresolved',
  'Cannot recognize the research object': 'apiErrors.messages.recognitionUnresolvedDefault',
  'Unable to recognize the research object': 'apiErrors.messages.recognitionUnresolvedDefault',
  'Recognition failed, please try again': 'apiErrors.messages.recognitionFailed',
  'Recognition service error': 'apiErrors.messages.recognitionUnknown',
  'Recognition result not found': 'apiErrors.messages.recognitionNotFound',
  'Research completed': 'apiErrors.messages.pollingCompleted',
  'Research partially completed': 'apiErrors.messages.pollingPartial',
  'Research failed': 'apiErrors.messages.pollingFailed',
  'Failed to fetch final report': 'apiErrors.messages.pollingReportFetchFailed',
  'Report data missing (terminal fallback)': 'apiErrors.messages.reportMissing',
  'Cancelled by user': 'apiErrors.messages.taskCancelled',
  'Internal server error': 'apiErrors.generic',
  'Internal server error, please try again later': 'apiErrors.generic',
  'Request failed': 'apiErrors.generic',
  'Account not found': 'apiErrors.messages.accountNotFound',
  'User not found by ID': 'apiErrors.messages.userNotFoundById',
  服务器内部错误: 'apiErrors.generic',
  '系统异常，请稍后重试。': 'apiErrors.generic',
  验证码不正确: 'apiErrors.messages.emailCodeInvalid',
  邮箱格式不正确: 'apiErrors.messages.emailInvalid',
};

const ERROR_CODE_KEYS: Readonly<Record<string, string>> = {
  EMAIL_CODE_SEND_FAILED: 'apiErrors.messages.emailCodeSendFailed',
  EMAIL_CODE_COOLDOWN: 'apiErrors.messages.emailCodeCooldown',
  EMAIL_CODE_RATE_LIMITED: 'apiErrors.messages.emailCodeRateLimited',
  EMAIL_CODE_INVALID: 'apiErrors.messages.emailCodeInvalid',
  EMAIL_CODE_USED: 'apiErrors.messages.emailCodeUsed',
  EMAIL_CODE_EXPIRED: 'apiErrors.messages.emailCodeExpired',
  EMAIL_INVALID: 'apiErrors.messages.emailInvalid',
  GOOGLE_CREDENTIAL_REQUIRED: 'apiErrors.messages.googleCredentialRequired',
  GOOGLE_ID_TOKEN_INVALID: 'apiErrors.messages.googleIdTokenInvalid',
  GOOGLE_LOGIN_NOT_CONFIGURED: 'apiErrors.messages.googleLoginNotConfigured',
  PASSWORD_INVALID: 'apiErrors.messages.passwordInvalid',
  PASSWORD_LOGIN_ADMIN_ONLY: 'apiErrors.messages.passwordAdminOnly',
  USER_DISABLED: 'apiErrors.messages.userDisabled',
  AUTH_TOKEN_EXPIRED: 'apiErrors.messages.tokenExpired',
  AUTH_TOKEN_INVALID: 'apiErrors.messages.tokenInvalid',
  RELAY_DISABLED: 'apiErrors.messages.relayDisabled',
  RELAY_ASSERTION_EXPIRED: 'apiErrors.messages.relayAssertionExpired',
  RELAY_ASSERTION_REPLAYED: 'apiErrors.messages.relayAssertionReplayed',
  RELAY_ASSERTION_INVALID: 'apiErrors.messages.relayAssertionInvalid',
  ANALYTICS_ADMIN_ONLY: 'apiErrors.messages.analyticsAdminOnly',
  'AUTH.TOKEN_MISSING': 'apiErrors.messages.tokenMissing',
  'AUTH.TOKEN_EXPIRED': 'apiErrors.messages.tokenExpired',
  'AUTH.TOKEN_INVALID': 'apiErrors.messages.tokenInvalid',
  'AUTH.FORBIDDEN': 'apiErrors.messages.accessDenied',
  'ACCOUNT.NOT_FOUND': 'apiErrors.messages.accountNotFound',
  'USER.NOT_FOUND_BY_ID': 'apiErrors.messages.userNotFoundById',
  'VALIDATION.FAILED': 'apiErrors.messages.validationFailed',
  VALIDATION_FAILED: 'apiErrors.messages.validationFailed',
  REPORT_NOT_RETRYABLE: 'apiErrors.messages.reportRetryNotAllowed',
  REPORT_RETRY_CONFLICT: 'apiErrors.messages.reportRetryConflict',
  REPORT_RETRY_FAILED: 'apiErrors.messages.reportRetryFailed',
};

const HTTP_CODE_KEYS: Readonly<Record<number, string>> = {
  200: 'apiErrors.messages.success',
  400: 'apiErrors.http.badRequest',
  401: 'apiErrors.http.unauthorized',
  403: 'apiErrors.http.forbidden',
  404: 'apiErrors.http.notFound',
  409: 'apiErrors.http.conflict',
  410: 'apiErrors.http.shareExpired',
  429: 'apiErrors.http.rateLimited',
  500: 'apiErrors.generic',
  503: 'apiErrors.generic',
};

type MessagePattern = Readonly<{
  pattern: RegExp;
  key: string;
  getOptions?: (match: RegExpMatchArray) => Readonly<Record<string, string>>;
}>;

const MESSAGE_PATTERNS: readonly MessagePattern[] = [
  {
    pattern:
      /^Maximum (\d+) research tasks can run concurrently\. Please wait for current tasks to complete or cancel one\s+first$/,
    key: 'apiErrors.messages.researchConcurrencyLimited',
    getOptions: (match) => ({ count: match[1] ?? '' }),
  },
  {
    pattern: /^Project is not awaiting resolution:\s*(.+)$/,
    key: 'apiErrors.messages.projectNotAwaitingResolution',
    getOptions: (match) => ({ status: match[1] ?? '' }),
  },
  {
    pattern: /^Only FAILED projects can be retried, current status:\s*(.+)$/,
    key: 'apiErrors.messages.onlyFailedProjectsRetry',
    getOptions: (match) => ({ status: match[1] ?? '' }),
  },
  {
    pattern: /^Project cancelled:\s*(.+)$/,
    key: 'apiErrors.messages.projectCancelled',
    getOptions: (match) => ({ workflowId: match[1] ?? '' }),
  },
  {
    pattern: /^Unknown preflight status:\s*(.+)$/,
    key: 'apiErrors.messages.unknownPreflightStatus',
    getOptions: (match) => ({ status: match[1] ?? '' }),
  },
  {
    pattern: /^Image file too large,?\s*max\s*(.+)$/,
    key: 'apiErrors.messages.imageTooLarge',
    getOptions: (match) => ({ size: match[1] ?? '' }),
  },
  {
    pattern: /^File too large,?\s*max\s*(.+)$/,
    key: 'apiErrors.messages.fileTooLarge',
    getOptions: (match) => ({ size: match[1] ?? '' }),
  },
  {
    pattern: /^Stock not found in\s+(.+)\s+market$/,
    key: 'apiErrors.messages.stockNotFoundInMarket',
    getOptions: (match) => ({ market: match[1] ?? '' }),
  },
  {
    pattern: /^Research polling timeout: no new events for a long period$/,
    key: 'apiErrors.messages.pollingTimeout',
  },
  {
    pattern: /^Research timeout: exceeded maximum run time$/,
    key: 'apiErrors.messages.pollingStale',
  },
  {
    pattern: /^Report data missing \(Runner did not return the capability report\)$/,
    key: 'apiErrors.messages.reportFetchFailed',
  },
];

export function resolveApiErrorMessage(
  message: string | null | undefined,
): ApiErrorMessageMatch | undefined {
  const normalized = message?.trim();
  if (!normalized) {
    return undefined;
  }

  const exactKey = EXACT_MESSAGE_KEYS[normalized];
  if (exactKey) {
    return { key: exactKey };
  }

  for (const descriptor of MESSAGE_PATTERNS) {
    const match = normalized.match(descriptor.pattern);
    if (match) {
      return {
        key: descriptor.key,
        ...(descriptor.getOptions ? { options: descriptor.getOptions(match) } : {}),
      };
    }
  }

  return undefined;
}

export function resolveApiErrorKey(context: ApiErrorMessageContext): string | undefined {
  const errorCode = context.errorCode?.trim();
  if (errorCode && ERROR_CODE_KEYS[errorCode]) {
    return ERROR_CODE_KEYS[errorCode];
  }

  const codeCandidates = [context.apiCode, context.code, context.status];
  for (const candidate of codeCandidates) {
    const numericCode = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isInteger(numericCode) && HTTP_CODE_KEYS[numericCode]) {
      return HTTP_CODE_KEYS[numericCode];
    }
  }

  return undefined;
}
