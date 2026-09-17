import type { MarketCode } from '../../../market';
import type {
  AgentReport,
  ResearchCompany,
  ResearchEvent,
  ResearchProjectSnapshot,
} from '../../model/research.types';

export type MockTimelinePoint = {
  /** 相对于本轮 timeline 开始的毫秒数；0 表示可立即读取的初始快照。 */
  afterMs: number;
  snapshot: ResearchProjectSnapshot;
  events?: readonly ResearchEvent[];
};

export type MockScenarioCoverage = {
  hasLongContent: boolean;
  hasMissingOptionalFields: boolean;
  supportsReentry: boolean;
  hasFailureBlockedState: boolean;
  hasRetryProgression: boolean;
};

/**
 * Mock 专用 scenario schema。
 *
 * 它刻意使用 domain snapshot，而不是复制 API DTO；scenario 只描述开发态
 * 如何表达状态矩阵和时间推进，不能被页面或生产 API 当成服务端调度契约。
 */
export type MockResearchScenario = {
  scenarioId: string;
  projectId: string;
  objectType: Exclude<ResearchProjectSnapshot['project']['objectType'], 'unknown'>;
  market: MarketCode;
  description: string;
  timeline: readonly MockTimelinePoint[];
  retry?: {
    agentType: string;
    timeline: readonly MockTimelinePoint[];
  };
  reports: Readonly<Record<string, AgentReport>>;
  companies?: readonly ResearchCompany[];
  requestDelayMs?: number;
  coverage: MockScenarioCoverage;
};
