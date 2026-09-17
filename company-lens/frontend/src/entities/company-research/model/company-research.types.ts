export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const COMPANY_RESEARCH_LANGUAGES = ['zh-CN', 'en-US'] as const;
export type CompanyResearchLanguage = (typeof COMPANY_RESEARCH_LANGUAGES)[number];
export type CompanyResearchLanguageValue = CompanyResearchLanguage | 'unknown';

export const COMPANY_RESEARCH_TASK_STATUSES = [
  'pending',
  'resolving',
  'collecting',
  'analyzing',
  'synthesizing',
  'completed',
  'partial',
  'failed',
  'cancelled',
  'unknown',
] as const;

export type CompanyResearchTaskStatus = (typeof COMPANY_RESEARCH_TASK_STATUSES)[number];

export const COMPANY_RESEARCH_CAPABILITY_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'disabled',
  'unknown',
] as const;

export type CompanyResearchCapabilityStatus = (typeof COMPANY_RESEARCH_CAPABILITY_STATUSES)[number];

export type CompanyResearchCapability = Readonly<{
  name: string;
  displayName?: string;
  status: CompanyResearchCapabilityStatus;
  retryable?: boolean;
}>;

export type CompanyResearchMessage = Readonly<{
  id?: string;
  conversationId?: string;
  projectId?: string;
  agentRunId?: string;
  role?: string;
  content?: string;
  contentType?: string;
  stage?: string;
  seq?: number;
  metadata?: JsonValue;
  createTime?: string;
}>;

export type CompanyResearchAgentBlock = Readonly<{
  agentRunId?: string;
  agentName: string;
  displayName?: string;
  skillName?: string;
  eventAgentName?: string;
  status: CompanyResearchCapabilityStatus;
  retryable?: boolean;
  seq?: number;
  progress?: number;
  summary?: string;
  errorMessage?: string;
  confidence?: number;
  startedAt?: string;
  completedAt?: string;
  messages: readonly CompanyResearchMessage[];
}>;

export type CompanyResearchConclusion = Readonly<{
  decision?: string;
  confidence?: string;
  companyQuality?: string;
  valuationStatus?: string;
  longTermOutlook?: string;
  biggestOpportunity?: string;
  biggestOpportunityZh?: string;
  biggestOpportunityEn?: string;
  biggestRisk?: string;
  biggestRiskZh?: string;
  biggestRiskEn?: string;
}>;

export const COMPANY_RESEARCH_RECOGNITION_STATUSES = [
  'resolved',
  'ambiguous',
  'unsupported',
  'unresolved',
  'unknown',
] as const;

export type CompanyResearchRecognitionStatus =
  (typeof COMPANY_RESEARCH_RECOGNITION_STATUSES)[number];

export type CompanyResearchCandidate = Readonly<{
  candidateId: string;
  objectName: string;
  normalizedObjectName?: string;
  objectType?: string;
  companyName?: string;
  companyLegalName?: string;
  stockCode?: string;
  market?: string;
  exchange?: string;
  industry?: string;
  keyPeople?: string;
  relation?: string;
  canResearch: boolean;
  disabledReason?: string;
}>;

export type CompanyResearchRecognition = Readonly<{
  recognitionId: string;
  status: CompanyResearchRecognitionStatus;
  selectedCandidateId?: string;
  conversationId?: string;
  candidates: readonly CompanyResearchCandidate[];
  message?: string;
}>;

export type CompanyResearchStageStatus = 'pending' | 'running' | 'completed' | 'failed';

export type CompanyResearchStage = Readonly<{
  key: string;
  status: CompanyResearchStageStatus;
}>;

export type CompanyResearchTask = Readonly<{
  taskId: string;
  query: string;
  language?: CompanyResearchLanguageValue;
  status: CompanyResearchTaskStatus;
  objectType?: string;
  objectName?: string;
  companyName?: string;
  stockCode?: string;
  market?: string;
  exchange?: string;
  industry?: string;
  industryZh?: string;
  industryEn?: string;
  keyPeople?: string;
  objectRelation?: string;
  // TODO(company-research-api): GAP-001 - Remove optional fallback once TaskVO returns stable display metadata.
  researchFocus?: string;
  reportReady: boolean;
  finalResultAvailable?: boolean;
  synthesisFailed?: boolean;
  failReason?: string;
  capabilities: readonly CompanyResearchCapability[];
  systemMessages?: readonly CompanyResearchMessage[];
  agents?: readonly CompanyResearchAgentBlock[];
  // TODO(company-research-api): GAP-002 - Replace Mock stages when TaskVO/SSE provides stages[].
  stages?: readonly CompanyResearchStage[];
  conclusion?: CompanyResearchConclusion;
  // TODO(company-research-api): GAP-005 - Use server ownership/canBind/bound fields when available.
  canBind?: boolean;
  isBound?: boolean;
  createdAt?: string;
  completedAt?: string;
}>;

export type CompanyResearchHistoryItem = Readonly<{
  taskId: string;
  query: string;
  objectName?: string;
  objectType?: string;
  companyName?: string;
  stockCode?: string;
  market?: string;
  researchFocus?: string;
  status: CompanyResearchTaskStatus;
  finalResultAvailable?: boolean;
  synthesisFailed?: boolean;
  capabilities?: readonly CompanyResearchCapability[];
  conclusion?: CompanyResearchConclusion;
  createdAt?: string;
}>;

export type CompanyResearchHistoryPage = Readonly<{
  items: readonly CompanyResearchHistoryItem[];
  page: number;
  size: number;
  total: number;
}>;

// TODO(company-research-api): GAP-003 - Replace the compatibility record with the stable Report schema.
export type CompanyResearchReport = Readonly<Record<string, JsonValue>>;

export type CompanyResearchReportDocument = Readonly<{
  report: CompanyResearchReport;
  reportMarkdown?: string;
  reportMarkdownZh?: string;
  reportMarkdownEn?: string;
}>;

export type CompanyResearchAgentResult = Readonly<{
  agentName: string;
  reportMarkdown?: string;
  reportMarkdownZh?: string;
  reportMarkdownEn?: string;
  normalizedOutput?: JsonValue;
}>;

export type CompanyResearchCapabilityResult = Readonly<{
  agentName: string;
  reportReady: boolean;
  reportMarkdown?: string;
  reportMarkdownZh?: string;
  reportMarkdownEn?: string;
  normalizedOutput?: JsonValue;
  sources?: JsonValue;
}>;

export type CompanyResearchEvent = Readonly<{
  type: string;
  taskId?: string;
  seq?: number;
  isTerminal: boolean;
  conversationId?: string;
  query?: string;
  recognitionId?: string;
  status?: string;
  message?: string;
  failReason?: string;
  selectedCandidateId?: string;
  recognition?: CompanyResearchRecognition;
  agentRunId?: string;
  agentName?: string;
  displayName?: string;
  progress?: number;
  summary?: string;
  summaryZh?: string;
  summaryEn?: string;
  title?: string;
  titleZh?: string;
  titleEn?: string;
  reportMarkdown?: string;
  reportMarkdownZh?: string;
  reportMarkdownEn?: string;
  eventType?: string;
  skillName?: string;
  visibility?: string;
  sourceRefs?: readonly string[];
}>;

export type CompanyResearchEventSubscription = Readonly<{
  close: () => void;
}>;

export type CompanyResearchEventHandlers = Readonly<{
  onEvent: (event: CompanyResearchEvent) => void;
  onError?: (error: Error) => void;
}>;
