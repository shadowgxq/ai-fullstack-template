import type {
  AgentReport,
  ConfirmResearchResolutionCommand,
  CreateResearchCommand,
  ResearchCompany,
  ResearchEventHandlers,
  ResearchEventSubscription,
  ResearchMessage,
  ResearchProjectSnapshot,
  ResearchProject,
  StockCandidate,
} from '../model/research.types';

/**
 * 领域唯一的数据 contract。HTTP、SSE、fixture 和 scheduler 都在 adapter 内部实现，页面只看到本类型。
 */
export type ResearchRepository = {
  listProjects?: () => Promise<readonly ResearchProject[]>;
  searchStockCandidates: (query: string) => Promise<readonly StockCandidate[]>;
  createResearch: (command: CreateResearchCommand) => Promise<ResearchProject>;
  confirmResearchResolution: (
    command: ConfirmResearchResolutionCommand,
  ) => Promise<ResearchProject>;
  getProjectSnapshot: (projectId: string) => Promise<ResearchProjectSnapshot>;
  getConversationMessages?: (conversationId: string) => Promise<readonly ResearchMessage[]>;
  getAgentReport: (projectId: string, agentId: string) => Promise<AgentReport>;
  getCompany: (projectId: string, companyId: string) => Promise<ResearchCompany>;
  retryAgent: (projectId: string, agentType: string) => Promise<ResearchProjectSnapshot>;
  subscribeProjectEvents: (
    projectId: string,
    afterSeq: number,
    handlers: ResearchEventHandlers,
  ) => ResearchEventSubscription;
};
