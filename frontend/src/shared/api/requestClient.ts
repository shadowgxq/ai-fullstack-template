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

type AuthTaggedConfig = { __authToken?: string };

function markAuthInjected(config: InternalAxiosRequestConfig, token: string): void {
  (config as InternalAxiosRequestConfig & AuthTaggedConfig).__authToken = token;
}

function isCurrentAuthRequest(config: AxiosRequestConfig | undefined): boolean {
  const token = (config as (AxiosRequestConfig & AuthTaggedConfig) | undefined)?.__authToken;
  return typeof token === 'string' && token === getAuthToken();
}

/** A late 401 from an old request must not clear a newly established session. */
export function attachAuthInterceptors(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`);
      markAuthInjected(config, token);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        isCurrentAuthRequest(error.config)
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
