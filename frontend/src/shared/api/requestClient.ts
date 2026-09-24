import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { runtimeConfig } from '../config';
import { normalizeApiError } from './api-error';
import { getAuthToken, notifyUnauthorized } from './auth-token';

export type RequestConfig<TData = unknown> = AxiosRequestConfig<TData>;
export type RequestClient = AxiosInstance;

export function createRequestClient(config: AxiosRequestConfig = {}): AxiosInstance {
  return axios.create({
    baseURL: runtimeConfig.api.baseUrl,
    timeout: runtimeConfig.api.timeoutMs,
    ...config,
  });
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

type AuthTaggedConfig = { __authInjected?: boolean };

function markAuthInjected(config: InternalAxiosRequestConfig): void {
  (config as InternalAxiosRequestConfig & AuthTaggedConfig).__authInjected = true;
}

function isAuthInjected(config: AxiosRequestConfig | undefined): boolean {
  return (config as (AxiosRequestConfig & AuthTaggedConfig) | undefined)?.__authInjected === true;
}

/** Attach the current Bearer token and clear the session only for authenticated 401 responses. */
export function attachAuthInterceptors(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`);
      markAuthInjected(config);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        isAuthInjected(error.config)
      ) {
        notifyUnauthorized();
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const requestClient = attachAuthInterceptors(createRequestClient());

export const request = createRequest(requestClient);

export type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
