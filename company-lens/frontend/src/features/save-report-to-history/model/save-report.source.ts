import { runtimeConfig } from '../../../shared/config';
import { apiSaveReportGateway } from './save-report.api';
import type { SaveReportGateway } from './save-report.gateway';
import { mockSaveReportGateway } from './save-report.mock';

/**
 * 当前启用的「保存报告」数据源（composition 层唯一切换点）。
 * `VITE_RESEARCH_DATA_SOURCE=api` 走真实 product-service；默认 mock。
 * 页面、hooks、组件一律经由本导出访问，不写 if(mock) 分支。
 *
 * 与 `features/auth` 的 `auth.source.ts`、`features/research-history` 的
 * `research-history.source.ts` 同一模式；与登录注册的数据源开关相互独立。
 */
export const saveReportGateway: SaveReportGateway =
  runtimeConfig.researchDataSource === 'api' ? apiSaveReportGateway : mockSaveReportGateway;
