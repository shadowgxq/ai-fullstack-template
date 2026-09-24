import { isAuthError } from './auth.gateway';

/**
 * 只有稳定的领域错误码允许进入业务翻译表；未知错误不能把服务端原文
 * 直接展示给当前 locale，统一使用公共系统异常文案。
 */
export function resolveAuthErrorText(error: unknown, t: (key: string) => string): string | null {
  if (!error) return null;
  if (isAuthError(error) && error.code !== 'generic') {
    return t(`auth.errors.${error.code}`);
  }
  return t('errors.system');
}
