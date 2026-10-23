import Taro from '@tarojs/taro';
import { getAuthSession } from '../../shared/api/auth-token';

const loginRoute = 'pages/login/index';
let redirecting: Promise<unknown> | null = null;

/** 清空私人页面栈，避免登录页返回到已退出的账户页面；多个 401 共用一次跳转。 */
export function redirectToLogin(): Promise<unknown> {
  if (getAuthSession()) return Promise.resolve();
  const pages = Taro.getCurrentPages();
  if (pages[pages.length - 1]?.route?.replace(/^\//, '') === loginRoute) return Promise.resolve();
  if (redirecting) return redirecting;
  redirecting = Taro.reLaunch({ url: '/' + loginRoute })
    .catch(() => Taro.showToast({ title: '登录页暂时无法打开，请重新进入', icon: 'none' }))
    .finally(() => {
      redirecting = null;
    });
  return redirecting;
}
