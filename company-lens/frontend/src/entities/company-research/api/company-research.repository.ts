import type {
  CompanyResearchEventHandlers,
  CompanyResearchEventSubscription,
  CompanyResearchCapabilityResult,
  CompanyResearchHistoryPage,
  CompanyResearchLanguage,
  CompanyResearchReportDocument,
  CompanyResearchTask,
} from '../model/company-research.types';

export type CompanyResearchTaskQueryOptions = Readonly<{
  includeMessages?: boolean;
}>;

export type CompanyResearchRepository = Readonly<{
  subscribeRecognition: (
    query: string,
    handlers: CompanyResearchEventHandlers,
    language?: CompanyResearchLanguage,
  ) => CompanyResearchEventSubscription;
  createTask: (input: {
    recognitionId: string;
    candidateId: string;
    query?: string;
    conversationId?: string;
    language?: CompanyResearchLanguage;
  }) => Promise<CompanyResearchTask>;
  getTask: (
    taskId: string,
    options?: CompanyResearchTaskQueryOptions,
  ) => Promise<CompanyResearchTask>;
  getReport: (taskId: string) => Promise<CompanyResearchReportDocument>;
  getCapabilityResult: (
    taskId: string,
    capability: string,
  ) => Promise<CompanyResearchCapabilityResult>;
  retryCapability: (taskId: string, capability: string) => Promise<void>;
  retryReport: (taskId: string) => Promise<void>;
  listHistory: (input: {
    keyword?: string;
    page: number;
    size: number;
  }) => Promise<CompanyResearchHistoryPage>;
  deleteHistory: (taskId: string) => Promise<void>;
  bindTask: (taskId: string) => Promise<void>;
  subscribeEvents: (
    taskId: string,
    handlers: CompanyResearchEventHandlers,
    afterSeq?: number,
  ) => CompanyResearchEventSubscription;
}>;
