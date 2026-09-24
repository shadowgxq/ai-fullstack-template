import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { isApiError, normalizeApiError } from './api-error';

describe('normalizeApiError', () => {
  it('normalizes axios response payloads', () => {
    const response: AxiosResponse = {
      config: {
        headers: new AxiosHeaders(),
      },
      data: {
        msg: 'Invalid input',
        code: 'VALIDATION_FAILED',
        errorCode: 'EMAIL_INVALID',
        details: { field: 'name' },
      },
      headers: {},
      status: 422,
      statusText: 'Unprocessable Entity',
    };
    const error = AxiosError.from(
      new Error('Network Error'),
      undefined,
      undefined,
      undefined,
      response,
    );

    expect(normalizeApiError(error)).toEqual({
      __apiError: true,
      message: 'Invalid input',
      messageFromServer: true,
      status: 422,
      code: 'VALIDATION_FAILED',
      errorCode: 'EMAIL_INVALID',
      details: { field: 'name' },
    });
  });

  it('reads the backend field errors from its data envelope', () => {
    const fields = [{ loc: ['body', 'username'], type: 'string_too_long', msg: 'Too long' }];
    const response: AxiosResponse = {
      config: { headers: new AxiosHeaders() },
      data: { code: 42200, message: 'Validation failed', data: fields },
      headers: {},
      status: 422,
      statusText: 'Unprocessable Entity',
    };
    const error = AxiosError.from(
      new Error('Invalid input'),
      undefined,
      undefined,
      undefined,
      response,
    );
    expect(normalizeApiError(error).details).toEqual(fields);
  });

  it('marks normalized errors', () => {
    const apiError = normalizeApiError(new Error('Forbidden'));

    expect(isApiError(apiError)).toBe(true);
    expect(apiError.message).toBe('Forbidden');
    expect(apiError.messageFromServer).toBe(false);
  });

  // 响应体没有 message/msg 时（后端未部署、网关直出 HTML、断网），
  // axios 会给出 "Request failed with status code 404" 这类英文串。
  // 它必须被标记为非服务端来源，否则会原样漏进本地化界面。
  it('响应体没有文案时不把 axios 的传输层信息当作服务端文案', () => {
    const response: AxiosResponse = {
      config: { headers: new AxiosHeaders() },
      data: '<!doctype html><title>404</title>',
      headers: {},
      status: 404,
      statusText: 'Not Found',
    };
    const error = AxiosError.from(
      new Error('Request failed with status code 404'),
      undefined,
      undefined,
      undefined,
      response,
    );

    const apiError = normalizeApiError(error);

    expect(apiError.messageFromServer).toBe(false);
    expect(apiError.message).toBe('Request failed with status code 404');
    expect(apiError.status).toBe(404);
  });

  it('忽略响应体里的空白文案', () => {
    const response: AxiosResponse = {
      config: { headers: new AxiosHeaders() },
      data: { message: '   ' },
      headers: {},
      status: 500,
      statusText: 'Internal Server Error',
    };
    const error = AxiosError.from(new Error('boom'), undefined, undefined, undefined, response);

    expect(normalizeApiError(error).messageFromServer).toBe(false);
  });
});
