import { runtimeConfig } from '../../../shared/config';
import { apiAuthGateway } from './auth.api';
import type { AuthGateway } from './auth.gateway';
import { mockAuthGateway } from './auth.mock';

/**
 * 当前启用的认证数据源（composition 层唯一切换点）。
 * `VITE_DATA_SOURCE=api` 走真实 product-service（默认）；显式设为 mock 时使用本地数据。
 * 页面、hooks、组件一律经由本导出访问，不写 if(mock) 分支。
 */
export const authGateway: AuthGateway =
  runtimeConfig.dataSource === 'api' ? apiAuthGateway : mockAuthGateway;
