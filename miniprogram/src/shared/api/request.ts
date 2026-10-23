import Taro from '@tarojs/taro';
import { ApiError, abortError, isRecord } from './errors';
import {
  getAuthSession,
  getSessionGeneration,
  notifyUnauthorized,
  onSessionChange,
} from './auth-token';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
  idempotencyKey?: string;
  auth?: boolean;
  signal?: AbortSignal;
}

export function resolveApiUrl(baseUrl: string, path: string): string {
  if (!baseUrl) throw new ApiError('尚未配置后端服务地址', 'configuration');
  // 只接受站内路径，不能把 Bearer token 发送到任意地址。
  if (!/^\/(?!\/)/.test(path) || /[\\#]/.test(path)) {
    throw new ApiError('API 路径必须是站内绝对路径', 'configuration');
  }
  return baseUrl + path;
}

export function requestJson<T>(
  path: string,
  parse: (value: unknown) => T,
  options: RequestOptions = {},
): Promise<T> {
  if (options.signal?.aborted) return Promise.reject(abortError());
  let url: string;
  try {
    url = resolveApiUrl(__API_BASE_URL__, path);
  } catch (error) {
    return Promise.reject(error);
  }
  const requestSession = options.auth === false ? null : getAuthSession();
  const requestGeneration = getSessionGeneration();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let task: ReturnType<typeof Taro.request> | undefined;
    let unsubscribeSession: (() => void) | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribeSession?.();
      options.signal?.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => {
      finish(() => reject(abortError()));
      try {
        task?.abort();
      } catch {
        /* 外层已拒绝，宿主 abort 失败不能阻断会话隔离。 */
      }
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.auth !== false)
      unsubscribeSession = onSessionChange(() => {
        if (getSessionGeneration() !== requestGeneration) onAbort();
      });
    try {
      task = Taro.request({
        url,
        method: options.method ?? 'GET',
        data: options.data,
        timeout: 15000,
        header: {
          'Content-Type': 'application/json',
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
          ...(requestSession ? { Authorization: `Bearer ${requestSession.token}` } : {}),
        },
        success(response) {
          if (settled) return;
          finish(() => {
            if (response.statusCode === 401) {
              // 迟到的旧会话 401 不得清除新会话；清理错误不覆盖原始 HTTP 错误。
              try {
                notifyUnauthorized(requestSession);
              } catch {
                /* Preserve the request error. */
              }
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
              const body: unknown = response.data;
              const message =
                response.statusCode === 401
                  ? '登录已失效，请重新登录'
                  : response.statusCode === 422
                    ? '输入内容不符合要求，请检查后重试'
                    : response.statusCode >= 500
                      ? '服务暂时不可用，请稍后重试'
                      : '请求未成功，请重试';
              reject(
                new ApiError(
                  message,
                  'http',
                  response.statusCode,
                  isRecord(body) && typeof body.code === 'number' ? body.code : undefined,
                  isRecord(body) ? body.data : undefined,
                ),
              );
              return;
            }
            try {
              resolve(parse(response.data));
            } catch (error) {
              reject(error);
            }
          });
        },
        fail() {
          finish(() => reject(new ApiError('网络连接失败或请求超时，请检查网络后重试', 'network')));
        },
      });
      // Taro 同时提供回调和 Promise；外层已归一化失败，消费内部拒绝避免 unhandled rejection。
      void task.catch(() => undefined);
      // 防止宿主同步回调触发取消后遗漏底层 abort。
      if (options.signal?.aborted) task.abort();
    } catch {
      finish(() => reject(new ApiError('无法发起网络请求', 'network')));
    }
  });
}

export function parseEnvelope<T>(value: unknown, parseData: (data: unknown) => T): T {
  if (
    !isRecord(value) ||
    typeof value.code !== 'number' ||
    typeof value.message !== 'string' ||
    !('data' in value)
  ) {
    throw new ApiError('服务返回的数据格式不正确', 'invalid-response');
  }
  if (value.code !== 0)
    throw new ApiError('操作未成功，请检查输入后重试', 'business', undefined, value.code);
  return parseData(value.data);
}
