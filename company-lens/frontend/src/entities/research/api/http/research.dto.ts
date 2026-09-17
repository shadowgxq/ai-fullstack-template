import { ResearchError } from '../../model/research.errors';

export type ResultDto<TData> = {
  code: number;
  message?: string | null;
  msg?: string | null;
  errorCode?: string | null;
  data: TData;
};

export type PageResultDto<TRecord> = {
  total: number;
  page: number;
  size: number;
  records: readonly TRecord[];
};

export type ProjectVO = {
  id: string;
  userId?: string | null;
  deviceId?: string | null;
  conversationId?: string | null;
  query: string;
  objectType?: string | null;
  normalizedName?: string | null;
  market?: string | null;
  status: string;
  progress?: number | null;
  industryConclusion?: string | null;
  maxRisk?: string | null;
  agentConsensus?: string | null;
  agentDivergence?: string | null;
  dataSources?: string | null;
  canCancel?: boolean | null;
  canRetry?: boolean | null;
  canRerun?: boolean | null;
  resultReady?: boolean | null;
  resultCompleteness?: number | null;
  reportReady?: boolean | null;
  preflightStatus?: string | null;
  preflightMessage?: string | null;
  resolutions: readonly PreflightResolutionVO[];
  agents: readonly AgentRunVO[];
  finalists: readonly FinalistVO[];
  createTime?: string | null;
  updateTime?: string | null;
};

export type PreflightResolutionVO = {
  type: string;
  market: string;
  resolvedQuery: string;
  label: string;
};

export type CreateResearchProjectRequestDto = {
  query: string;
  market: import('../../../market').MarketCode;
  objectType?: 'COMPANY';
  normalizedName?: string;
};

export type AgentRunVO = {
  id: string;
  agentName: string;
  displayName?: string | null;
  status: string;
  seq?: number | null;
  progress?: number | null;
  summary?: string | null;
  retryCount?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
};

export type FinalistVO = {
  companyName?: string | null;
  ticker?: string | null;
  rankNo?: number | null;
  reason?: string | null;
  market?: string | null;
  sourceAgent?: string | null;
  score?: number | null;
  conclusion?: string | null;
  strengths?: string | null;
  risks?: string | null;
  agentContributions?: string | null;
  qualityConclusion?: string | null;
  nextSteps?: string | null;
};

export type StockInfoVO = {
  source: string;
  transCode: string;
  name: string;
  market?: string | null;
  primaryExchange?: string | null;
};

export type AgentResultVO = {
  agentRunId: string;
  agentName: string;
  displayName?: string | null;
  status: string;
  summary?: string | null;
  dataSources?: string | null;
  confidence?: number | null;
  result?: {
    format: string;
    content: string;
  } | null;
};

export type MessageVO = {
  id: string;
  conversationId: string;
  projectId?: string | null;
  agentRunId?: string | null;
  role: string;
  content: string;
  contentType: string;
  stage: string;
  seq?: number | null;
  metadata?: unknown;
  createTime?: string | null;
};

type SseBaseDto = {
  seq: number;
  projectId?: string;
};

export type AgentStatusEventDto = SseBaseDto & {
  type?: string;
  agentRunId: string;
  agentName: string;
  displayName?: string;
  status: string;
  progress?: number;
};

export type AgentProgressEventDto = SseBaseDto & {
  type?: string;
  agentRunId: string;
  agentName: string;
  displayName?: string;
  progress: number;
  summary?: string;
  title?: string;
  eventType?: string;
  skillName?: string;
  visibility?: string;
  sourceRefs?: readonly string[];
  timestamp?: string;
};

export type AgentSummaryEventDto = SseBaseDto & {
  type?: string;
  agentRunId: string;
  agentName: string;
  summary: string;
};

export type AgentCompletedEventDto = SseBaseDto & {
  type?: string;
  projectId: string;
  agentRunId: string;
  agentName: string;
  displayName?: string;
  progress?: number;
};

export type WorkflowCompletedEventDto = SseBaseDto & {
  type?: string;
  projectId: string;
};

export type ProjectStatusEventDto = SseBaseDto & {
  type?: string;
  projectId: string;
  status: string;
  progress?: number;
};

export type HeartbeatEventDto = {
  seq: 0;
  type?: string;
};

export type DoneEventDto = {
  seq: -1;
  type?: string;
  projectId?: string;
  message?: string;
};

export type ResearchSseEventDto =
  | { event: 'agent_status'; data: AgentStatusEventDto }
  | { event: 'agent_progress'; data: AgentProgressEventDto }
  | { event: 'agent_summary'; data: AgentSummaryEventDto }
  | { event: 'agent_completed'; data: AgentCompletedEventDto }
  | { event: 'workflow_completed'; data: WorkflowCompletedEventDto }
  | { event: 'message'; data: MessageVO }
  | { event: 'project_status'; data: ProjectStatusEventDto }
  | { event: 'heartbeat'; data: HeartbeatEventDto }
  | { event: 'done'; data: DoneEventDto };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ResearchError('contract-invalid', `${field} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'string') {
    throw new ResearchError('contract-invalid', `${field} must be a string or null.`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ResearchError('contract-invalid', `${field} must be a finite number or null.`);
  }
  return value;
}

function optionalStringArray(value: unknown, field: string): readonly string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ResearchError('contract-invalid', `${field} must be an array of strings or null.`);
  }
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'boolean') {
    throw new ResearchError('contract-invalid', `${field} must be a boolean or null.`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ResearchError('contract-invalid', `${field} must be a finite number.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ResearchError('contract-invalid', `${field} must be a non-negative integer.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  const number = requireNonNegativeInteger(value, field);
  if (number < 1) {
    throw new ResearchError('contract-invalid', `${field} must be a positive integer.`);
  }
  return number;
}

function parseAgentRun(value: unknown, index: number): AgentRunVO {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', `agents[${index}] must be an object.`);
  }

  return {
    id: requireString(value.id, `agents[${index}].id`),
    agentName: requireString(value.agentName, `agents[${index}].agentName`),
    displayName: optionalString(value.displayName, `agents[${index}].displayName`),
    status: requireString(value.status, `agents[${index}].status`),
    seq: optionalNumber(value.seq, `agents[${index}].seq`),
    progress: optionalNumber(value.progress, `agents[${index}].progress`),
    summary: optionalString(value.summary, `agents[${index}].summary`),
    retryCount: optionalNumber(value.retryCount, `agents[${index}].retryCount`),
    startedAt: optionalString(value.startedAt, `agents[${index}].startedAt`),
    completedAt: optionalString(value.completedAt, `agents[${index}].completedAt`),
    errorMessage: optionalString(value.errorMessage, `agents[${index}].errorMessage`),
  };
}

function parseFinalist(value: unknown, index: number): FinalistVO {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', `finalists[${index}] must be an object.`);
  }

  return {
    companyName: optionalString(value.companyName, `finalists[${index}].companyName`),
    ticker: optionalString(value.ticker, `finalists[${index}].ticker`),
    rankNo: optionalNumber(value.rankNo, `finalists[${index}].rankNo`),
    reason: optionalString(value.reason, `finalists[${index}].reason`),
    market: optionalString(value.market, `finalists[${index}].market`),
    sourceAgent: optionalString(value.sourceAgent, `finalists[${index}].sourceAgent`),
    score: optionalNumber(value.score, `finalists[${index}].score`),
    conclusion: optionalString(value.conclusion, `finalists[${index}].conclusion`),
    strengths: optionalString(value.strengths, `finalists[${index}].strengths`),
    risks: optionalString(value.risks, `finalists[${index}].risks`),
    agentContributions: optionalString(
      value.agentContributions,
      `finalists[${index}].agentContributions`,
    ),
    qualityConclusion: optionalString(
      value.qualityConclusion,
      `finalists[${index}].qualityConclusion`,
    ),
    nextSteps: optionalString(value.nextSteps, `finalists[${index}].nextSteps`),
  };
}

function parsePreflightResolution(value: unknown, index: number): PreflightResolutionVO {
  if (!isRecord(value)) {
    throw new ResearchError(
      'contract-invalid',
      `preflightResolutions[${index}] must be an object.`,
    );
  }

  return {
    type: requireString(value.type, `preflightResolutions[${index}].type`),
    market: requireString(value.market, `preflightResolutions[${index}].market`),
    resolvedQuery: requireString(
      value.resolvedQuery,
      `preflightResolutions[${index}].resolvedQuery`,
    ),
    label: requireString(value.label, `preflightResolutions[${index}].label`),
  };
}

export function parseResultDto(value: unknown): ResultDto<unknown> {
  if (!isRecord(value) || typeof value.code !== 'number' || !hasOwn(value, 'data')) {
    throw new ResearchError('contract-invalid', 'Response must contain a Result<T> envelope.');
  }
  if (value.message !== undefined && value.message !== null && typeof value.message !== 'string') {
    throw new ResearchError('contract-invalid', 'Result.message must be a string or null.');
  }
  if (value.msg !== undefined && value.msg !== null && typeof value.msg !== 'string') {
    throw new ResearchError('contract-invalid', 'Result.msg must be a string or null.');
  }
  if (
    value.errorCode !== undefined &&
    value.errorCode !== null &&
    typeof value.errorCode !== 'string'
  ) {
    throw new ResearchError('contract-invalid', 'Result.errorCode must be a string or null.');
  }
  return {
    code: value.code,
    message: value.message as string | null | undefined,
    msg: value.msg as string | null | undefined,
    errorCode: value.errorCode as string | null | undefined,
    data: value.data,
  };
}

export function parseProjectVO(value: unknown): ProjectVO {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', 'ProjectVO must be an object.');
  }
  if (
    (value.agents !== null && !Array.isArray(value.agents)) ||
    (value.finalists !== null && !Array.isArray(value.finalists)) ||
    (value.resolutions !== undefined &&
      value.resolutions !== null &&
      !Array.isArray(value.resolutions)) ||
    (value.preflightResolutions !== undefined &&
      value.preflightResolutions !== null &&
      !Array.isArray(value.preflightResolutions))
  ) {
    throw new ResearchError(
      'contract-invalid',
      'ProjectVO agents, finalists and resolutions must be arrays or null.',
    );
  }

  const agents = value.agents ?? [];
  const finalists = value.finalists ?? [];
  const resolutions = value.resolutions ?? value.preflightResolutions ?? [];

  return {
    id: requireString(value.id, 'ProjectVO.id'),
    userId: optionalString(value.userId, 'ProjectVO.userId'),
    deviceId: optionalString(value.deviceId, 'ProjectVO.deviceId'),
    conversationId: optionalString(value.conversationId, 'ProjectVO.conversationId'),
    query: requireString(value.query, 'ProjectVO.query'),
    objectType: optionalString(value.objectType, 'ProjectVO.objectType'),
    normalizedName: optionalString(value.normalizedName, 'ProjectVO.normalizedName'),
    market: optionalString(value.market, 'ProjectVO.market'),
    status: requireString(value.status, 'ProjectVO.status'),
    progress: optionalNumber(value.progress, 'ProjectVO.progress'),
    industryConclusion: optionalString(value.industryConclusion, 'ProjectVO.industryConclusion'),
    maxRisk: optionalString(value.maxRisk, 'ProjectVO.maxRisk'),
    agentConsensus: optionalString(value.agentConsensus, 'ProjectVO.agentConsensus'),
    agentDivergence: optionalString(value.agentDivergence, 'ProjectVO.agentDivergence'),
    dataSources: optionalString(value.dataSources, 'ProjectVO.dataSources'),
    canCancel: optionalBoolean(value.canCancel, 'ProjectVO.canCancel'),
    canRetry: optionalBoolean(value.canRetry, 'ProjectVO.canRetry'),
    canRerun: optionalBoolean(value.canRerun, 'ProjectVO.canRerun'),
    resultReady: optionalBoolean(value.resultReady, 'ProjectVO.resultReady'),
    resultCompleteness: optionalNumber(value.resultCompleteness, 'ProjectVO.resultCompleteness'),
    reportReady: optionalBoolean(value.reportReady, 'ProjectVO.reportReady'),
    preflightStatus: optionalString(value.preflightStatus, 'ProjectVO.preflightStatus'),
    preflightMessage: optionalString(value.preflightMessage, 'ProjectVO.preflightMessage'),
    resolutions: resolutions.map(parsePreflightResolution),
    agents: agents.map(parseAgentRun),
    finalists: finalists.map(parseFinalist),
    createTime: optionalString(value.createTime, 'ProjectVO.createTime'),
    updateTime: optionalString(value.updateTime, 'ProjectVO.updateTime'),
  };
}

export function parsePageResultDto<TRecord>(
  value: unknown,
  parseRecord: (record: unknown, index: number) => TRecord,
): PageResultDto<TRecord> {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    throw new ResearchError('contract-invalid', 'PageResult<T> must contain records.');
  }
  return {
    total: requireNonNegativeInteger(value.total, 'PageResult.total'),
    page: requirePositiveInteger(value.page ?? value.current, 'PageResult.page'),
    size: requirePositiveInteger(value.size, 'PageResult.size'),
    records: value.records.map(parseRecord),
  };
}

export function parseStockInfoVO(value: unknown, index = 0): StockInfoVO {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', `stocks[${index}] must be an object.`);
  }
  return {
    source: requireString(value.source, `stocks[${index}].source`),
    transCode: requireString(value.transCode, `stocks[${index}].transCode`),
    name: requireString(value.name, `stocks[${index}].name`),
    market: optionalString(value.market, `stocks[${index}].market`),
    primaryExchange: optionalString(value.primaryExchange, `stocks[${index}].primaryExchange`),
  };
}

export function parseStockInfoList(value: unknown): readonly StockInfoVO[] {
  if (!Array.isArray(value)) {
    throw new ResearchError('contract-invalid', 'Stock search data must be an array.');
  }
  return value.map(parseStockInfoVO);
}

export function parseAgentResultVO(value: unknown): AgentResultVO {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', 'AgentResultVO must be an object.');
  }
  let result: AgentResultVO['result'];
  if (value.result === null || value.result === undefined) {
    result = value.result;
  } else if (isRecord(value.result)) {
    result = {
      format: requireString(value.result.format, 'AgentResultVO.result.format'),
      content: requireString(value.result.content, 'AgentResultVO.result.content'),
    };
  } else {
    throw new ResearchError('contract-invalid', 'AgentResultVO.result must be an object or null.');
  }
  return {
    agentRunId: requireString(value.agentRunId, 'AgentResultVO.agentRunId'),
    agentName: requireString(value.agentName, 'AgentResultVO.agentName'),
    displayName: optionalString(value.displayName, 'AgentResultVO.displayName'),
    status: requireString(value.status, 'AgentResultVO.status'),
    summary: optionalString(value.summary, 'AgentResultVO.summary'),
    dataSources: optionalString(value.dataSources, 'AgentResultVO.dataSources'),
    confidence: optionalNumber(value.confidence, 'AgentResultVO.confidence'),
    result,
  };
}

export function parseFinalistVO(value: unknown): FinalistVO {
  return parseFinalist(value, 0);
}

export function parseMessageVO(value: unknown): MessageVO {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', 'MessageVO must be an object.');
  }

  return {
    id: requireString(value.id, 'MessageVO.id'),
    conversationId: requireString(value.conversationId, 'MessageVO.conversationId'),
    projectId: optionalString(value.projectId, 'MessageVO.projectId'),
    agentRunId: optionalString(value.agentRunId, 'MessageVO.agentRunId'),
    role: requireString(value.role, 'MessageVO.role'),
    content: requireString(value.content, 'MessageVO.content'),
    contentType: requireString(value.contentType, 'MessageVO.contentType'),
    stage: requireString(value.stage, 'MessageVO.stage'),
    seq: optionalNumber(value.seq, 'MessageVO.seq'),
    metadata: value.metadata,
    createTime: optionalString(value.createTime, 'MessageVO.createTime'),
  };
}

function parseSseBase(value: unknown, eventName: string): SseBaseDto {
  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', `${eventName} event must be an object.`);
  }
  return {
    seq: requireNumber(value.seq, `${eventName}.seq`),
    projectId:
      value.projectId === undefined
        ? undefined
        : requireString(value.projectId, `${eventName}.projectId`),
  };
}

export function parseResearchSseEvent(eventName: string, value: unknown): ResearchSseEventDto {
  if (eventName === 'message') {
    return { event: eventName, data: parseMessageVO(value) };
  }

  if (!isRecord(value)) {
    throw new ResearchError('contract-invalid', `${eventName} event must be an object.`);
  }

  if (eventName === 'heartbeat') {
    const base = parseSseBase(value, eventName);
    if (base.seq !== 0) {
      throw new ResearchError('contract-invalid', 'heartbeat.seq must be 0.');
    }
    return {
      event: eventName,
      data: { seq: 0, type: optionalString(value.type, 'heartbeat.type') ?? undefined },
    };
  }

  if (eventName === 'done') {
    const base = parseSseBase(value, eventName);
    if (base.seq !== -1) {
      throw new ResearchError('contract-invalid', 'done.seq must be -1.');
    }
    return {
      event: eventName,
      data: {
        seq: -1,
        type: optionalString(value.type, 'done.type') ?? undefined,
        projectId: base.projectId,
        message: optionalString(value.message, 'done.message') ?? undefined,
      },
    };
  }

  const base = parseSseBase(value, eventName);
  if (eventName === 'agent_completed') {
    return {
      event: eventName,
      data: {
        ...base,
        projectId: requireString(value.projectId, 'agent_completed.projectId'),
        agentRunId: requireString(value.agentRunId, 'agent_completed.agentRunId'),
        agentName: requireString(value.agentName, 'agent_completed.agentName'),
        displayName: optionalString(value.displayName, 'agent_completed.displayName') ?? undefined,
        progress: optionalNumber(value.progress, 'agent_completed.progress') ?? undefined,
        type: optionalString(value.type, 'agent_completed.type') ?? undefined,
      },
    };
  }

  if (eventName === 'workflow_completed') {
    return {
      event: eventName,
      data: {
        ...base,
        projectId: requireString(value.projectId, 'workflow_completed.projectId'),
        type: optionalString(value.type, 'workflow_completed.type') ?? undefined,
      },
    };
  }

  if (eventName === 'agent_status') {
    return {
      event: eventName,
      data: {
        ...base,
        agentRunId: requireString(value.agentRunId, 'agent_status.agentRunId'),
        agentName: requireString(value.agentName, 'agent_status.agentName'),
        displayName: optionalString(value.displayName, 'agent_status.displayName') ?? undefined,
        status: requireString(value.status, 'agent_status.status'),
        progress: optionalNumber(value.progress, 'agent_status.progress') ?? undefined,
        type: optionalString(value.type, 'agent_status.type') ?? undefined,
      },
    };
  }

  if (eventName === 'agent_progress') {
    return {
      event: eventName,
      data: {
        ...base,
        agentRunId: requireString(value.agentRunId, 'agent_progress.agentRunId'),
        agentName: requireString(value.agentName, 'agent_progress.agentName'),
        displayName: optionalString(value.displayName, 'agent_progress.displayName') ?? undefined,
        progress: requireNumber(value.progress, 'agent_progress.progress'),
        summary: optionalString(value.summary, 'agent_progress.summary') ?? undefined,
        title: optionalString(value.title, 'agent_progress.title') ?? undefined,
        eventType: optionalString(value.eventType, 'agent_progress.eventType') ?? undefined,
        skillName: optionalString(value.skillName, 'agent_progress.skillName') ?? undefined,
        visibility: optionalString(value.visibility, 'agent_progress.visibility') ?? undefined,
        sourceRefs: optionalStringArray(value.sourceRefs, 'agent_progress.sourceRefs'),
        timestamp: optionalString(value.timestamp, 'agent_progress.timestamp') ?? undefined,
        type: optionalString(value.type, 'agent_progress.type') ?? undefined,
      },
    };
  }

  if (eventName === 'agent_summary') {
    return {
      event: eventName,
      data: {
        ...base,
        agentRunId: requireString(value.agentRunId, 'agent_summary.agentRunId'),
        agentName: requireString(value.agentName, 'agent_summary.agentName'),
        summary: requireString(value.summary, 'agent_summary.summary'),
        type: optionalString(value.type, 'agent_summary.type') ?? undefined,
      },
    };
  }

  if (eventName === 'project_status') {
    return {
      event: eventName,
      data: {
        ...base,
        projectId: requireString(value.projectId, 'project_status.projectId'),
        status: requireString(value.status, 'project_status.status'),
        progress: optionalNumber(value.progress, 'project_status.progress') ?? undefined,
        type: optionalString(value.type, 'project_status.type') ?? undefined,
      },
    };
  }

  throw new ResearchError('contract-invalid', `Unsupported research SSE event: ${eventName}.`);
}
