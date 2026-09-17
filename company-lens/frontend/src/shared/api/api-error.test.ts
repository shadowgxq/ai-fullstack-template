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
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { field: 'name' },
    });
  });

  it('marks normalized errors', () => {
    const apiError = normalizeApiError(new Error('Forbidden'));

    expect(isApiError(apiError)).toBe(true);
    expect(apiError.message).toBe('Forbidden');
  });

  it('preserves account errorCode from an Axios response', () => {
    const response: AxiosResponse = {
      config: {
        headers: new AxiosHeaders(),
      },
      data: {
        code: 429,
        errorCode: 'EMAIL_CODE_COOLDOWN',
        msg: 'Verification code sent too frequently, please try again later',
      },
      headers: {},
      status: 429,
      statusText: 'Too Many Requests',
    };
    const error = AxiosError.from(
      new Error('Request failed'),
      undefined,
      undefined,
      undefined,
      response,
    );

    expect(normalizeApiError(error)).toMatchObject({
      code: 429,
      errorCode: 'EMAIL_CODE_COOLDOWN',
      message: 'Verification code sent too frequently, please try again later',
      status: 429,
    });
  });
});
