import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';

import { i18n } from '../i18n';
import { getApiErrorMessage, translateApiMessage } from './api-error-message';

describe('api error message translation', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('translates a registered English message in the current locale', async () => {
    await i18n.changeLanguage('zh');

    expect(translateApiMessage('Invalid verification code')).toBe('验证码无效。');

    await i18n.changeLanguage('en');
    expect(translateApiMessage('Invalid verification code')).toBe('Invalid verification code.');
  });

  it('prefers errorCode over message and HTTP status', async () => {
    await i18n.changeLanguage('zh');

    expect(
      getApiErrorMessage({
        errorCode: 'EMAIL_CODE_INVALID',
        message: 'Internal server error',
        status: 500,
      }),
    ).toBe('验证码无效。');
  });

  it('translates dynamic message values without losing placeholders', async () => {
    await i18n.changeLanguage('zh');

    expect(translateApiMessage('File too large, max 10 MB')).toBe('文件过大，最大限制：10 MB。');
  });

  it('translates the concurrent research task limit with its configured count', async () => {
    const message =
      'Maximum 5 research tasks can run concurrently. Please wait for current tasks to complete or cancel one first';

    await i18n.changeLanguage('zh');
    expect(translateApiMessage(message, { status: 429 })).toBe(
      '你已有 5 个研究任务正在运行，请等待任务完成或取消一个现有任务后再试。',
    );

    await i18n.changeLanguage('en');
    expect(translateApiMessage(message, { status: 429 })).toBe(
      'You already have 5 research tasks running. Please wait for one to finish or cancel an existing task before starting another.',
    );
  });

  it('supports account msg responses and falls back for unknown errors', async () => {
    await i18n.changeLanguage('zh');

    expect(getApiErrorMessage({ msg: 'Invalid email address' })).toBe('邮箱地址无效。');
    expect(getApiErrorMessage({ message: 'Unexpected upstream failure' })).toBe(
      '系统异常，请稍后重试。',
    );
  });

  it('uses the HTTP status when an Axios code is not numeric', async () => {
    await i18n.changeLanguage('en');

    expect(
      getApiErrorMessage({
        message: 'Unexpected upstream failure',
        code: 'ERR_BAD_REQUEST',
        status: 404,
      }),
    ).toBe('Resource not found.');
  });

  it('translates message and errorCode from a raw Axios response', async () => {
    await i18n.changeLanguage('zh');
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
      new Error('Request failed with status code 429'),
      undefined,
      undefined,
      undefined,
      response,
    );

    expect(getApiErrorMessage(error)).toBe('验证码发送过于频繁，请稍后重试。');
  });
});
