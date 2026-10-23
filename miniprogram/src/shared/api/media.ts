import Taro from '@tarojs/taro';
import type { components } from './schema.generated';
import { isRecord } from './errors';
import { getAuthSession, notifyUnauthorized, onSessionChange } from './auth-token';
import { ApiError, abortError } from './errors';
import { parseEnvelope, resolveApiUrl } from './request';

const downloadedPaths = new Set<string>();
function discardPath(path: string): void {
  downloadedPaths.delete(path);
  try {
    Taro.getFileSystemManager().unlink({ filePath: path, fail: () => undefined });
  } catch {
    /* 已丢弃内存引用；宿主不可用时不能宣称文件删除成功。 */
  }
}
onSessionChange(() => {
  for (const path of downloadedPaths) discardPath(path);
});

function requireSession() {
  const session = getAuthSession();
  if (!session) throw new ApiError('请先微信登录', 'http', 401);
  return session;
}
function mediaHttpError(status: number): ApiError {
  return new ApiError(
    status === 401
      ? '登录已失效，请重新登录'
      : status === 409
        ? '上传操作冲突，请重新选择照片'
        : status === 422 || status === 413
          ? '图片格式、尺寸或大小不符合要求'
          : '图片请求失败，请重试',
    'http',
    status,
  );
}

export function uploadPrivatePhoto(
  filePath: string,
  key: string,
  purpose: MediaPurpose,
  signal?: AbortSignal,
): Promise<MediaReady> {
  if (signal?.aborted) return Promise.reject(abortError());
  const session = requireSession();
  const url = resolveApiUrl(__API_BASE_URL__, '/api/v1/media');
  return new Promise((resolve, reject) => {
    let settled = false;
    let task: ReturnType<typeof Taro.uploadFile> | undefined;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      signal?.removeEventListener('abort', cancel);
      action();
    };
    const cancel = () => {
      finish(() => reject(abortError()));
      try {
        task?.abort();
      } catch {
        /* 迟到响应仍由settled隔离。 */
      }
    };
    const unsubscribe = onSessionChange(cancel);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      task = Taro.uploadFile({
        url,
        filePath,
        name: 'file',
        formData: { purpose },
        timeout: 30000,
        header: { Authorization: 'Bearer ' + session.token, 'Idempotency-Key': key },
        success(response) {
          if (settled) return;
          finish(() => {
            if (getAuthSession() !== session) {
              reject(abortError());
              return;
            }
            if (response.statusCode === 401) {
              try {
                notifyUnauthorized(session);
              } catch {
                /* 保留原HTTP错误。 */
              }
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
              reject(mediaHttpError(response.statusCode));
              return;
            }
            try {
              resolve(
                parseEnvelope(JSON.parse(response.data) as unknown, (value) =>
                  parseMedia(value, purpose),
                ),
              );
            } catch (error) {
              reject(
                error instanceof ApiError
                  ? error
                  : new ApiError('图片上传响应格式不正确', 'invalid-response'),
              );
            }
          });
        },
        fail() {
          finish(() => reject(new ApiError('图片上传失败或超时，请重试', 'network')));
        },
      });
      void task.catch(() => undefined);
      if (signal?.aborted) cancel();
    } catch {
      finish(() => reject(new ApiError('无法发起图片上传', 'network')));
    }
  });
}

export function downloadPrivatePhoto(mediaId: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) return Promise.reject(abortError());
  const session = requireSession();
  const url = resolveApiUrl(
    __API_BASE_URL__,
    '/api/v1/media/' + encodeURIComponent(mediaId) + '/content',
  );
  return new Promise((resolve, reject) => {
    let settled = false;
    let task: ReturnType<typeof Taro.downloadFile> | undefined;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      signal?.removeEventListener('abort', cancel);
      action();
    };
    const cancel = () => {
      finish(() => reject(abortError()));
      try {
        task?.abort();
      } catch {
        /* 旧路径永不进入新会话。 */
      }
    };
    const unsubscribe = onSessionChange(cancel);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      task = Taro.downloadFile({
        url,
        header: { Authorization: 'Bearer ' + session.token },
        timeout: 15000,
        success(response) {
          const path = response.tempFilePath;
          if (settled || getAuthSession() !== session) {
            if (path) discardPath(path);
            finish(() => reject(abortError()));
            return;
          }
          finish(() => {
            if (response.statusCode === 401) {
              try {
                notifyUnauthorized(session);
              } catch {
                /* 保留HTTP错误。 */
              }
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
              if (path) discardPath(path);
              reject(mediaHttpError(response.statusCode));
              return;
            }
            if (typeof path !== 'string' || !path) {
              reject(new ApiError('未取得可显示的图片', 'invalid-response'));
              return;
            }
            downloadedPaths.add(path);
            resolve(path);
          });
        },
        fail() {
          finish(() => reject(new ApiError('图片下载失败，请重试', 'network')));
        },
      });
      void task.catch(() => undefined);
      if (signal?.aborted) cancel();
    } catch {
      finish(() => reject(new ApiError('无法发起图片下载', 'network')));
    }
  });
}

export type MediaReady = components['schemas']['MediaResponse'];
export type MediaPurpose = MediaReady['purpose'];
export function parseMedia(value: unknown, purpose: MediaPurpose): MediaReady {
  const positive = (field: unknown): field is number =>
    typeof field === 'number' && Number.isSafeInteger(field) && field > 0;
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) ||
    value.purpose !== purpose ||
    value.status !== 'ready' ||
    typeof value.content_type !== 'string' ||
    !value.content_type.startsWith('image/') ||
    !positive(value.size_bytes) ||
    !positive(value.width) ||
    !positive(value.height)
  )
    throw new ApiError('图片上传响应格式不正确', 'invalid-response');
  return {
    id: value.id,
    purpose,
    status: 'ready',
    content_type: value.content_type,
    size_bytes: value.size_bytes,
    width: value.width,
    height: value.height,
  };
}
