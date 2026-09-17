export { createRequest, createRequestClient, request, requestClient } from './requestClient';
export type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  RequestClient,
  RequestConfig,
} from './requestClient';
export { isApiError, normalizeApiError, type ApiError } from './api-error';
export { getApiErrorMessage, translateApiMessage } from './api-error-message';
export type { ApiErrorMessageContext, ApiErrorMessageMatch } from './api-error-catalog';
export {
  getAuthToken,
  notifyUnauthorized,
  setAuthToken,
  setUnauthorizedHandler,
} from './auth-token';
export {
  getApiLanguage,
  getApiLanguageHeaders,
  selectApiLanguageText,
  toApiLanguage,
  type ApiLanguage,
} from './request-language';
