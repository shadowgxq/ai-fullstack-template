import Taro from '@tarojs/taro';
import { abortError, isRecord } from '../api/errors';

/** 仅供明确点击定位后的调用；宿主没有取消API，取消后丢弃返回坐标。 */
export function requestFuzzyLocation(
  signal?: AbortSignal,
): Promise<{ latitude: number; longitude: number } | null> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (typeof Taro.getFuzzyLocation !== 'function')
    return Promise.reject(new Error('当前微信环境不支持模糊定位，请手动搜索城市'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      action();
    };
    const cancel = () => finish(() => reject(abortError()));
    signal?.addEventListener('abort', cancel, { once: true });
    const fail = (error: unknown) => {
      if (signal?.aborted) {
        cancel();
        return;
      }
      const message = isRecord(error) && typeof error.errMsg === 'string' ? error.errMsg : '';
      finish(() =>
        /cancel/i.test(message)
          ? resolve(null)
          : reject(new Error('无法取得位置，请检查定位授权或手动搜索城市')),
      );
    };
    try {
      void Taro.getFuzzyLocation({ type: 'gcj02' }).then((result) => {
        if (signal?.aborted) {
          cancel();
          return;
        }
        finish(() => {
          if (
            !Number.isFinite(result.latitude) ||
            result.latitude < -90 ||
            result.latitude > 90 ||
            !Number.isFinite(result.longitude) ||
            result.longitude < -180 ||
            result.longitude > 180
          )
            reject(new Error('未取得有效位置，请手动搜索城市'));
          else resolve({ latitude: result.latitude, longitude: result.longitude });
        });
      }, fail);
    } catch (error) {
      fail(error);
    }
  });
}
