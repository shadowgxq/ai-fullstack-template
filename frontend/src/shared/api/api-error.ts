import axios from 'axios';

const DEFAULT_API_ERROR_MESSAGE = 'Request failed';

export type ApiError = {
  __apiError: true;
  message: string;
  /**
   * `message` 是否取自响应体。为 false 时它来自传输层（如 axios 的
   * "Request failed with status code 404"），是面向开发者的英文串，
   * 不能直接展示给用户——调用方应改用自己的本地化兜底文案。
   */
  messageFromServer: boolean;
  status?: number;
  code?: string | number;
  /** Business error code returned by modules such as account authentication. */
  errorCode?: string;
  details?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isApiError(error: unknown): error is ApiError {
  return isRecord(error) && error.__apiError === true && typeof error.message === 'string';
}

export function normalizeApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const data = isRecord(error.response?.data) ? error.response.data : undefined;
    // 只有响应体里的 message/msg 才算「服务端说的人话」；axios 自己的
    // error.message 属于传输层，仅作为最后兜底且标记为非服务端来源。
    const serverMessage =
      (typeof data?.message === 'string' && data.message.trim()) ||
      (typeof data?.msg === 'string' && data.msg.trim()) ||
      undefined;
    const code =
      typeof data?.code === 'string' || typeof data?.code === 'number' ? data.code : error.code;

    return {
      __apiError: true,
      message: serverMessage || error.message || DEFAULT_API_ERROR_MESSAGE,
      messageFromServer: Boolean(serverMessage),
      status: error.response?.status,
      code,
      errorCode: typeof data?.errorCode === 'string' ? data.errorCode : undefined,
      details: data?.details ?? data?.data,
    };
  }

  return {
    __apiError: true,
    message: error instanceof Error ? error.message : DEFAULT_API_ERROR_MESSAGE,
    messageFromServer: false,
  };
}
