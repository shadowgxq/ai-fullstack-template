import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { runtimeConfig } from '../config';
import { DEVICE_ID_HEADER, getDeviceId } from '../identity';
import { normalizeApiError } from './api-error';
import { getAuthToken, notifyUnauthorized } from './auth-token';
import { getApiLanguageHeaders } from './request-language';

export type RequestConfig<TData = unknown> = AxiosRequestConfig<TData>;
export type RequestClient = AxiosInstance;

/** 每个请求带上匿名设备 id，保证未登录用户也能被后端识别与归属数据。 */
function attachDeviceId(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  config.headers.set(DEVICE_ID_HEADER, getDeviceId());
  return config;
}

/** 已登录时带上 Bearer 令牌；未登录则只有 device id。 */
function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getAuthToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}

/** 每个 HTTP 请求都带上当前 UI 语言，供服务端翻译即时错误和状态文案。 */
function attachApiLanguage(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const languageHeaders = getApiLanguageHeaders();
  Object.entries(languageHeaders).forEach(([name, value]) => config.headers.set(name, value));
  return config;
}

export function createRequestClient(config: AxiosRequestConfig = {}): AxiosInstance {
  const client = axios.create({
    baseURL: runtimeConfig.api.baseUrl,
    timeout: runtimeConfig.api.timeoutMs,
    ...config,
  });

  client.interceptors.request.use(attachDeviceId);
  client.interceptors.request.use(attachAuth);
  client.interceptors.request.use(attachApiLanguage);
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      // 带着 token 却 401：会话已失效，通知 auth 域清除本地会话。
      if (axios.isAxiosError(error) && error.response?.status === 401 && getAuthToken()) {
        notifyUnauthorized();
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export function createRequest(client: AxiosInstance) {
  return async function request<TResponse = unknown, TData = unknown>(
    config: RequestConfig<TData>,
  ): Promise<TResponse> {
    try {
      const response = await client.request<TResponse, AxiosResponse<TResponse>, TData>(config);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  };
}

export const requestClient = createRequestClient();

export const request = createRequest(requestClient);

export type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
