import type {
  RESEARCH_AGENT_STATUSES,
  RESEARCH_EVIDENCE_CATEGORIES,
  RESEARCH_MESSAGE_STAGES,
  RESEARCH_OBJECT_TYPES,
  RESEARCH_PROJECT_STATUSES,
  RESEARCH_REPORT_STATUSES,
  RESEARCH_RESULT_COMPLETENESS,
} from './research.constants';

export type ResearchObjectType = (typeof RESEARCH_OBJECT_TYPES)[number];
export type ResearchProjectStatus = (typeof RESEARCH_PROJECT_STATUSES)[number];
export type ResearchAgentStatus = (typeof RESEARCH_AGENT_STATUSES)[number];
export type ResearchReportStatus = (typeof RESEARCH_REPORT_STATUSES)[number];
export type ResearchResultCompleteness = (typeof RESEARCH_RESULT_COMPLETENESS)[number];
export type ResearchMessageStage = (typeof RESEARCH_MESSAGE_STAGES)[number];
export type ResearchEvidenceCategory = (typeof RESEARCH_EVIDENCE_CATEGORIES)[number];

export type ProjectStatus = ResearchProjectStatus;
export type AgentStatus = ResearchAgentStatus;
export type ReportStatus = ResearchReportStatus;
export type ResultCompleteness = ResearchResultCompleteness;

export type ResearchMarket = import('../../market').MarketCode | 'unknown';

export type StockCandidate = {
  stockId: string;
  companyName: string;
  symbol: string;
  market: import('../../market').MarketCode;
  exchange: string;
};

export type ResearchDraft = {
  query: string;
  selectedMarket: import('../../market').MarketCode;
  selectedStock?: StockCandidate;
};

export type CreateResearchCommand = {
  query: string;
  selectedMarket: import('../../market').MarketCode;
  selectedStock?: StockCandidate;
};

export type ResearchPreflightResolutionType = 'switch_market' | 'related_market';

export type ResearchPreflightResolution = {
  type: ResearchPreflightResolutionType;
  market: import('../../market').MarketCode;
  resolvedQuery: string;
  label: string;
};

export type ConfirmResearchResolutionCommand = {
  projectId: string;
  resolution: ResearchPreflightResolutionType;
  market: import('../../market').MarketCode;
};

export type ResearchProject = {
  projectId: string;
  query: string;
  normalizedName?: string;
  objectType: ResearchObjectType;
  rawObjectType?: string;
  market: ResearchMarket;
  rawMarket?: string;
  status: ResearchProjectStatus;
  rawStatus?: string;
  requiresResolution?: true;
  preflightStatus?: string;
  preflightMessage?: string;
  preflightResolutions?: readonly ResearchPreflightResolution[];
  conversationId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ResearchAgentProgress = {
  agentId: string;
  agentType: string;
  displayName?: string;
  displayOrder?: number;
  status: ResearchAgentStatus;
  rawStatus?: string;
  progressPercent?: number;
  summary?: string;
  errorMessage?: string;
  retryCount?: number;
  startedAt?: string;
  completedAt?: string;
  reportReady: boolean;
  canRetry: boolean;
};

export type ResearchThinkingStep = {
  stepId: string;
  agentId: string;
  agentType: string;
  summary: string;
  displayName?: string;
  title?: string;
  progressPercent?: number;
  eventType?: string;
  skillName?: string;
  visibility?: string;
  sourceRefs?: readonly string[];
  timestamp?: string;
  seq?: number;
};

export type AgentProgressItem = ResearchAgentProgress;

export type ResearchProgress = {
  projectId: string;
  status: ResearchProjectStatus;
  rawStatus?: string;
  progressPercent?: number;
  resultReady: boolean;
  resultCompleteness: ResearchResultCompleteness;
  agentTasks: readonly ResearchAgentProgress[];
  failedAgentTypes?: readonly string[];
  progressMessage?: string;
};

export type ResearchEvidence = {
  category: ResearchEvidenceCategory;
  content: string;
  title?: string;
  sourceUrl?: string;
  publishedAt?: string;
  credibility?: string;
};

export type ResearchResultEntry = {
  key: string;
  category: ResearchEvidenceCategory;
  fact?: string;
  analysis?: string;
  riskToVerify?: string;
  value?: string;
};

export type ResearchFinalist = {
  companyName?: string;
  ticker?: string;
  rankNo?: number;
  reason?: string;
  companyId?: string;
};

export type ResearchResult = {
  projectId: string;
  researchMode: ResearchObjectType;
  resultReady: boolean;
  resultCompleteness: ResearchResultCompleteness;
  conclusion?: string;
  maxRisk?: string;
  consensus?: string;
  divergence?: string;
  dataSources?: string;
  finalists?: readonly ResearchFinalist[];
  researchChain?: readonly ResearchResultEntry[];
  agentSummaries?: readonly ResearchResultEntry[];
  confidence?: number;
  informationClassification?: string;
  missingReports?: readonly string[];
  evidenceGaps?: readonly string[];
  limitations?: readonly string[];
  evidence?: readonly ResearchEvidence[];
  qualityScore?: number;
};

export type AgentReportBlock = {
  stage: ResearchMessageStage;
  rawStage?: string;
  content: string;
  contentType?: ResearchMessage['contentType'];
  rawContentType?: string;
  messageIds: readonly string[];
  messageSequences?: readonly number[];
};

export type ResearchCompany = {
  projectId: string;
  companyId: string;
  companyName?: string;
  ticker?: string;
  market: ResearchMarket;
  rawMarket?: string;
  conclusion?: string;
  whySelected?: string;
  strengths?: readonly string[];
  risks?: readonly string[];
  agentContributions?: readonly ResearchResultEntry[];
  consensus?: string;
  divergence?: string;
  nextValidation?: readonly string[];
  qualityConclusion?: string;
  qualityScore?: number;
};

export type AgentReport = {
  projectId: string;
  agentId: string;
  agentType: string;
  status: ResearchAgentStatus;
  rawStatus?: string;
  reportStatus: ResearchReportStatus;
  reportReady: boolean;
  summary?: string;
  errorMessage?: string;
  blocks?: readonly AgentReportBlock[];
  sources?: readonly ResearchEvidence[];
  rawReport?: string;
  dataSources?: string;
  confidence?: number;
  standardizedResult?: ResearchResultEntry;
};

export type ResearchProjectSnapshot = {
  project: ResearchProject;
  progress: ResearchProgress;
  result: ResearchResult;
  contractIssues?: readonly ResearchContractIssue[];
};

export type ResearchMessage = {
  messageId: string;
  conversationId: string;
  projectId?: string;
  agentRunId?: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'unknown';
  rawRole?: string;
  content: string;
  contentType: 'TEXT' | 'MARKDOWN' | 'HTML' | 'JSON' | 'unknown';
  rawContentType?: string;
  stage: ResearchMessageStage;
  rawStage?: string;
  messageSequence?: number;
  metadata?: unknown;
  createdAt?: string;
};

export type ResearchEvent =
  | {
      type: 'agent_status';
      projectId: string;
      agentId: string;
      agentType: string;
      status: ResearchAgentStatus;
      rawStatus?: string;
      progressPercent?: number;
      displayName?: string;
      seq: number;
    }
  | {
      type: 'agent_progress';
      projectId: string;
      agentId: string;
      agentType: string;
      progressPercent: number;
      displayName?: string;
      summary?: string;
      title?: string;
      eventType?: string;
      skillName?: string;
      visibility?: string;
      sourceRefs?: readonly string[];
      timestamp?: string;
      seq: number;
    }
  | {
      type: 'agent_summary';
      projectId: string;
      agentId: string;
      agentType: string;
      summary: string;
      seq: number;
    }
  | {
      type: 'agent_completed';
      projectId: string;
      agentId: string;
      agentType: string;
      displayName?: string;
      progressPercent?: number;
      seq: number;
    }
  | {
      type: 'workflow_completed';
      projectId: string;
      seq: number;
    }
  | {
      type: 'message';
      projectId: string;
      message: ResearchMessage;
      messageSequence?: number;
    }
  | {
      type: 'project_status';
      projectId: string;
      status: ResearchProjectStatus;
      rawStatus?: string;
      progressPercent?: number;
      seq: number;
    }
  | {
      type: 'heartbeat';
      seq: 0;
    }
  | {
      type: 'done';
      projectId?: string;
      seq: -1;
      message?: string;
    };

export type ResearchEventHandlers = {
  onEvent?: (event: ResearchEvent) => void;
  onSnapshotInvalidated?: () => void;
  onError?: (error: Error) => void;
};

export type ResearchEventSubscription = {
  unsubscribe: () => void;
};

export type ResearchContractIssue = {
  code: 'running-agent-limit-exceeded' | 'snapshot-inconsistent';
  message: string;
  projectId?: string;
  details?: Readonly<Record<string, unknown>>;
};
