import { runtimeConfig } from '../../../shared/config';
import { apiResearchHistoryGateway } from './research-history.api';
import type { ResearchHistoryGateway } from './research-history.gateway';
import { mockResearchHistoryGateway } from './research-history.mock';

/**
 * 当前启用的历史分析数据源（composition 层唯一切换点）。
 * `VITE_RESEARCH_DATA_SOURCE=api` 走真实 product-service；默认 mock。
 * 页面、hooks、组件一律经由本导出访问，不写 if(mock) 分支。
 *
 * 历史记录属于公司研究契约，与登录注册的数据源开关相互独立。
 */
export const researchHistoryGateway: ResearchHistoryGateway =
  runtimeConfig.researchDataSource === 'api'
    ? apiResearchHistoryGateway
    : mockResearchHistoryGateway;
