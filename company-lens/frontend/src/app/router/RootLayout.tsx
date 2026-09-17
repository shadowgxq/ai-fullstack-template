import { Outlet } from 'react-router-dom';

import { LoginModal } from '../../features/auth';

/**
 * 无路径布局路由：托管全局登录弹窗。
 * 弹窗最初挂在 AppProviders（RouterProvider 之外）以覆盖包括 404 在内的全部路由，
 * 代价是子树不能用 Router context。现在 AuthForm 里有「忘记密码」的 <Link>，
 * 按当时预留的迁移路径挪到这里：无路径路由包住全部子路由（含 404 与 /login shim），
 * 覆盖面不变，弹窗子树从此可以正常使用路由能力。
 *
 * 单独成文件而非留在 routes.tsx：那里还导出路由表（非组件），
 * 同文件混放会让 fast refresh 失效（react-refresh/only-export-components）。
 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <LoginModal />
    </>
  );
}
