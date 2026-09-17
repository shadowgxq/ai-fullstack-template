import { i18n } from '../i18n';
import {
  resolveApiErrorKey,
  resolveApiErrorMessage,
  type ApiErrorMessageContext,
} from './api-error-catalog';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function codeValue(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function contextFromError(error: unknown): {
  message?: string;
  context: ApiErrorMessageContext;
} {
  if (typeof error === 'string') {
    return { message: error, context: {} };
  }
  if (!isRecord(error)) {
    return { context: {} };
  }

  const response = isRecord(error.response) ? error.response : undefined;
  const payload = isRecord(response?.data) ? response.data : undefined;
  const details = isRecord(error.details)
    ? error.details
    : isRecord(payload?.details)
      ? payload.details
      : undefined;
  const errorCode =
    stringValue(error.errorCode) ??
    stringValue(error.error_code) ??
    stringValue(payload?.errorCode) ??
    stringValue(payload?.error_code) ??
    stringValue(details?.errorCode) ??
    stringValue(details?.error_code);
  const apiCode = codeValue(error.apiCode) ?? codeValue(payload?.code) ?? codeValue(details?.code);
  const code = codeValue(error.code);
  const status =
    typeof error.status === 'number'
      ? error.status
      : typeof response?.status === 'number'
        ? response.status
        : undefined;
  const message =
    stringValue(error.serverMessage) ??
    stringValue(payload?.message) ??
    stringValue(payload?.msg) ??
    stringValue(error.message) ??
    stringValue(error.msg) ??
    stringValue(details?.message) ??
    stringValue(details?.msg);

  return {
    message,
    context: {
      ...(errorCode ? { errorCode } : {}),
      ...(code ? { code } : {}),
      ...(apiCode ? { apiCode } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  };
}

function translate(key: string, options?: Readonly<Record<string, string>>): string {
  return i18n.t(key, options);
}

/** 将服务端固定英文 message/errorCode 转成当前 UI 语言。未知值统一使用系统异常兜底。 */
export function translateApiMessage(
  message: string | null | undefined,
  context: ApiErrorMessageContext = {},
): string {
  const errorCodeKey = resolveApiErrorKey({ errorCode: context.errorCode });
  if (errorCodeKey) {
    return translate(errorCodeKey);
  }

  const messageMatch = resolveApiErrorMessage(message);
  if (messageMatch) {
    return translate(messageMatch.key, messageMatch.options);
  }

  const contextKey = resolveApiErrorKey({ ...context, errorCode: undefined });
  return translate(contextKey ?? 'apiErrors.generic');
}

/** 统一处理 AxiosError、业务域 Error 和直接传入的服务端错误文案。 */
export function getApiErrorMessage(error: unknown): string {
  const { message, context } = contextFromError(error);
  return translateApiMessage(message, context);
}
