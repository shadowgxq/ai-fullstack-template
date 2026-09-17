import { MAX_CONCURRENT_RESEARCH_AGENTS } from '../../model/research.constants';
import { ResearchError } from '../../model/research.errors';
import {
  getResearchSnapshotContractIssues,
  isProgressPercent,
} from '../../model/research.validators';
import type {
  AgentReport,
  ResearchPreflightResolution,
  ResearchCompany,
  ResearchAgentStatus,
  ResearchEvent,
  ResearchMessage,
  ResearchProjectSnapshot,
  ResearchProjectStatus,
  ResearchResultCompleteness,
} from '../../model/research.types';
import type {
  AgentResultVO,
  FinalistVO,
  MessageVO,
  ProjectVO,
  PreflightResolutionVO,
  ResearchSseEventDto,
} from './research.dto';

type MappedStatus<TStatus> = {
  status: TStatus;
  rawStatus?: string;
};

function mapProjectStatus(rawStatus: string): MappedStatus<ResearchProjectStatus> {
  switch (rawStatus) {
    case 'CREATED':
    case 'AWAITING_RESOLUTION':
      return { status: 'waiting' };
    case 'RUNNING':
      return { status: 'running' };
    case 'SUCCEEDED':
    case 'COMPLETED':
    case 'PARTIAL_FAILED':
      return { status: 'completed' };
    case 'FAILED':
      return { status: 'failed' };
    case 'CANCELLED':
      return { status: 'cancelled' };
    default:
      return { status: 'unknown', rawStatus };
  }
}

function mapAgentStatus(rawStatus: string): MappedStatus<ResearchAgentStatus> {
  switch (rawStatus) {
    case 'PENDING':
      return { status: 'waiting' };
    case 'RUNNING':
    case 'RETRYING':
      return { status: 'running' };
    case 'SUCCEEDED':
    case 'COMPLETED':
      return { status: 'completed' };
    case 'FAILED':
      return { status: 'failed' };
    case 'CANCELLED':
      return { status: 'cancelled' };
    default:
      return { status: 'unknown', rawStatus };
  }
}

function mapObjectType(rawObjectType: string | null | undefined) {
  switch (rawObjectType?.toUpperCase()) {
    case 'INDUSTRY':
      return { objectType: 'industry' as const };
    case 'THEME':
      return { objectType: 'theme' as const };
    case 'COMPANY':
      return { objectType: 'company' as const };
    default:
      return rawObjectType
        ? { objectType: 'unknown' as const, rawObjectType }
        : { objectType: 'unknown' as const };
  }
}

function mapMarket(rawMarket: string | null | undefined) {
  switch (rawMarket) {
    case 'US':
      return { market: 'US' as const };
    case 'CN':
      return { market: 'CN' as const };
    case 'HK':
      return { market: 'HK' as const };
    case 'JP':
      return { market: 'JP' as const };
    case 'KR':
      return { market: 'KR' as const };
    default:
      return rawMarket ? { market: 'unknown' as const, rawMarket } : { market: 'unknown' as const };
  }
}

function mapPreflightResolution(dto: PreflightResolutionVO): ResearchPreflightResolution {
  if (dto.type !== 'switch_market' && dto.type !== 'related_market') {
    throw new ResearchError(
      'contract-invalid',
      `Unsupported preflight resolution type: ${dto.type}.`,
    );
  }
  const mappedMarket = mapMarket(dto.market);
  if (mappedMarket.market === 'unknown') {
    throw new ResearchError(
      'contract-invalid',
      `Unsupported preflight resolution market: ${dto.market}.`,
    );
  }
  return {
    type: dto.type,
    market: mappedMarket.market,
    resolvedQuery: dto.resolvedQuery,
    label: dto.label,
  };
}

function mapProgress(value: number | null | undefined, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isProgressPercent(value)) {
    throw new ResearchError('contract-invalid', `${field} must be between 0 and 100.`);
  }
  return value;
}

function mapResultCompleteness(dto: ProjectVO): {
  resultReady: boolean;
  resultCompleteness: ResearchResultCompleteness;
} {
  // A running project can expose stale capability fields while its snapshot is refreshed.
  // Keep result access closed until the workflow reaches a terminal success state.
  if (dto.status === 'RUNNING') {
    return { resultReady: false, resultCompleteness: 'unavailable' };
  }

  if (dto.resultReady === true) {
    const completeness = dto.resultCompleteness;
    if (
      dto.reportReady === true ||
      (completeness !== undefined && completeness !== null && completeness >= 1)
    ) {
      return { resultReady: true, resultCompleteness: 'full' };
    }
    return { resultReady: true, resultCompleteness: 'partial' };
  }
  if (dto.status === 'SUCCEEDED' || dto.status === 'COMPLETED') {
    return { resultReady: true, resultCompleteness: 'full' };
  }
  if (dto.status === 'PARTIAL_FAILED') {
    return { resultReady: true, resultCompleteness: 'partial' };
  }
  return { resultReady: false, resultCompleteness: 'unavailable' };
}

function mapFinalist(dto: FinalistVO) {
  return {
    ...(dto.rankNo !== undefined && dto.rankNo !== null ? { companyId: String(dto.rankNo) } : {}),
    ...(dto.companyName !== undefined && dto.companyName !== null
      ? { companyName: dto.companyName }
      : {}),
    ...(dto.ticker !== undefined && dto.ticker !== null ? { ticker: dto.ticker } : {}),
    ...(dto.rankNo !== undefined && dto.rankNo !== null ? { rankNo: dto.rankNo } : {}),
    ...(dto.reason !== undefined && dto.reason !== null ? { reason: dto.reason } : {}),
  };
}

function mapAgentProgress(
  projectId: string,
  dto: ProjectVO['agents'][number],
): ResearchProjectSnapshot['progress']['agentTasks'][number] {
  const mappedStatus = mapAgentStatus(dto.status);
  const progressPercent = mapProgress(dto.progress, `agents.${dto.agentName}.progress`);

  return {
    agentId: dto.id,
    agentType: dto.agentName,
    ...(dto.displayName !== undefined && dto.displayName !== null
      ? { displayName: dto.displayName }
      : {}),
    ...(dto.seq !== undefined && dto.seq !== null ? { displayOrder: dto.seq } : {}),
    status: mappedStatus.status,
    ...(mappedStatus.rawStatus ? { rawStatus: mappedStatus.rawStatus } : {}),
    ...(progressPercent !== undefined ? { progressPercent } : {}),
    ...(dto.summary !== undefined && dto.summary !== null ? { summary: dto.summary } : {}),
    ...(dto.errorMessage !== undefined && dto.errorMessage !== null
      ? { errorMessage: dto.errorMessage }
      : {}),
    ...(dto.retryCount !== undefined && dto.retryCount !== null
      ? { retryCount: dto.retryCount }
      : {}),
    ...(dto.startedAt !== undefined && dto.startedAt !== null ? { startedAt: dto.startedAt } : {}),
    ...(dto.completedAt !== undefined && dto.completedAt !== null
      ? { completedAt: dto.completedAt }
      : {}),
    reportReady: mappedStatus.status === 'completed',
    canRetry: mappedStatus.status === 'failed',
  };
}

export function mapProjectVOToSnapshot(dto: ProjectVO): ResearchProjectSnapshot {
  const mappedProjectStatus = mapProjectStatus(dto.status);
  const mappedObjectType = mapObjectType(dto.objectType);
  const mappedMarket = mapMarket(dto.market);
  const resultState = mapResultCompleteness(dto);
  const progressPercent = mapProgress(dto.progress, 'ProjectVO.progress');
  const agentTasks = dto.agents.map((agent) => mapAgentProgress(dto.id, agent));
  const preflightResolutions = dto.resolutions.map(mapPreflightResolution);
  const failedAgentTypes = agentTasks
    .filter((agent) => agent.status === 'failed')
    .map((agent) => agent.agentType);

  const snapshot: ResearchProjectSnapshot = {
    project: {
      projectId: dto.id,
      query: dto.query,
      ...(dto.normalizedName !== undefined && dto.normalizedName !== null
        ? { normalizedName: dto.normalizedName }
        : {}),
      ...mappedObjectType,
      ...mappedMarket,
      status: mappedProjectStatus.status,
      ...(mappedProjectStatus.rawStatus ? { rawStatus: mappedProjectStatus.rawStatus } : {}),
      ...(dto.status === 'AWAITING_RESOLUTION' || dto.preflightStatus === 'CONFLICT'
        ? { requiresResolution: true as const }
        : {}),
      ...(dto.preflightStatus ? { preflightStatus: dto.preflightStatus } : {}),
      ...(dto.preflightMessage ? { preflightMessage: dto.preflightMessage } : {}),
      ...(preflightResolutions.length > 0 ? { preflightResolutions } : {}),
      ...(dto.conversationId !== undefined && dto.conversationId !== null
        ? { conversationId: dto.conversationId }
        : {}),
      ...(dto.createTime !== undefined && dto.createTime !== null
        ? { createdAt: dto.createTime }
        : {}),
      ...(dto.updateTime !== undefined && dto.updateTime !== null
        ? { updatedAt: dto.updateTime }
        : {}),
    },
    progress: {
      projectId: dto.id,
      status: mappedProjectStatus.status,
      ...(mappedProjectStatus.rawStatus ? { rawStatus: mappedProjectStatus.rawStatus } : {}),
      ...(progressPercent !== undefined ? { progressPercent } : {}),
      ...resultState,
      agentTasks,
      ...(failedAgentTypes.length > 0 ? { failedAgentTypes } : {}),
    },
    result: {
      projectId: dto.id,
      researchMode: mappedObjectType.objectType,
      ...resultState,
      ...(dto.industryConclusion !== undefined && dto.industryConclusion !== null
        ? { conclusion: dto.industryConclusion }
        : {}),
      ...(dto.maxRisk !== undefined && dto.maxRisk !== null ? { maxRisk: dto.maxRisk } : {}),
      ...(dto.agentConsensus !== undefined && dto.agentConsensus !== null
        ? { consensus: dto.agentConsensus }
        : {}),
      ...(dto.agentDivergence !== undefined && dto.agentDivergence !== null
        ? { divergence: dto.agentDivergence }
        : {}),
      ...(dto.dataSources !== undefined && dto.dataSources !== null
        ? { dataSources: dto.dataSources }
        : {}),
      finalists: dto.finalists.map(mapFinalist),
    },
  };

  const issues = getResearchSnapshotContractIssues(snapshot);
  if (issues.length === 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    contractIssues: issues,
  };
}

function splitDetailText(value: string | null | undefined): readonly string[] | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // The contract also permits plain text. Preserve it as one detail item.
  }
  return [normalized];
}

export function mapFinalistVOToCompany(
  projectId: string,
  companyId: string,
  dto: FinalistVO,
): ResearchCompany {
  const mappedMarket = mapMarket(dto.market);
  const contributions = dto.agentContributions?.trim();
  return {
    projectId,
    companyId,
    ...(dto.companyName ? { companyName: dto.companyName } : {}),
    ...(dto.ticker ? { ticker: dto.ticker } : {}),
    ...mappedMarket,
    ...(dto.conclusion ? { conclusion: dto.conclusion } : {}),
    ...(dto.reason ? { whySelected: dto.reason } : {}),
    ...(splitDetailText(dto.strengths) ? { strengths: splitDetailText(dto.strengths) } : {}),
    ...(splitDetailText(dto.risks) ? { risks: splitDetailText(dto.risks) } : {}),
    ...(contributions
      ? {
          agentContributions: [
            {
              key: dto.sourceAgent || 'agent-contributions',
              category: 'analysis',
              analysis: contributions,
            },
          ],
        }
      : {}),
    ...(splitDetailText(dto.nextSteps) ? { nextValidation: splitDetailText(dto.nextSteps) } : {}),
    ...(dto.qualityConclusion ? { qualityConclusion: dto.qualityConclusion } : {}),
    ...(dto.score !== undefined && dto.score !== null ? { qualityScore: dto.score } : {}),
  };
}

export function mapAgentResultVOToAgentReport(projectId: string, dto: AgentResultVO): AgentReport {
  const mappedStatus = mapAgentStatus(dto.status);
  const content = dto.result?.content.trim();
  const contentType = mapReportContentType(dto.result?.format);
  const isAvailable = mappedStatus.status === 'completed' && Boolean(content);
  return {
    projectId,
    agentId: dto.agentRunId,
    agentType: dto.agentName,
    status: mappedStatus.status,
    ...(mappedStatus.rawStatus ? { rawStatus: mappedStatus.rawStatus } : {}),
    reportStatus: isAvailable ? 'available' : 'unavailable',
    reportReady: isAvailable,
    ...(dto.summary ? { summary: dto.summary } : {}),
    ...(content
      ? {
          rawReport: content,
          blocks: [
            {
              stage: 'REPORT',
              content,
              contentType,
              messageIds: [`agent-result:${dto.agentRunId}`],
            },
          ],
        }
      : {}),
    ...(dto.dataSources ? { dataSources: dto.dataSources } : {}),
    ...(dto.confidence !== undefined && dto.confidence !== null
      ? { confidence: dto.confidence }
      : {}),
  };
}

function mapReportContentType(rawFormat: string | undefined): 'TEXT' | 'MARKDOWN' {
  const normalizedFormat = rawFormat?.trim().toUpperCase();

  return normalizedFormat === 'MARKDOWN' ||
    normalizedFormat === 'MD' ||
    normalizedFormat === 'TEXT/MARKDOWN'
    ? 'MARKDOWN'
    : 'TEXT';
}

function mapRole(rawRole: string): ResearchMessage['role'] {
  switch (rawRole) {
    case 'USER':
    case 'ASSISTANT':
    case 'SYSTEM':
      return rawRole;
    default:
      return 'unknown';
  }
}

function mapContentType(rawContentType: string): ResearchMessage['contentType'] {
  const normalizedContentType = rawContentType.trim().toUpperCase();

  switch (normalizedContentType) {
    case 'TEXT':
    case 'HTML':
    case 'JSON':
      return normalizedContentType;
    case 'MARKDOWN':
    case 'MD':
    case 'TEXT/MARKDOWN':
      return 'MARKDOWN';
    default:
      return 'unknown';
  }
}

function mapMessageStage(rawStage: string): ResearchMessage['stage'] {
  switch (rawStage) {
    case 'THINKING':
    case 'REPORT':
    case 'CITATION':
    case 'APPENDIX':
    case 'ATTACHMENT':
      return rawStage;
    default:
      return 'unknown';
  }
}

export function mapMessageVOToResearchMessage(dto: MessageVO): ResearchMessage {
  const message = {
    messageId: dto.id,
    conversationId: dto.conversationId,
    ...(dto.projectId !== undefined && dto.projectId !== null ? { projectId: dto.projectId } : {}),
    ...(dto.agentRunId !== undefined && dto.agentRunId !== null
      ? { agentRunId: dto.agentRunId }
      : {}),
    role: mapRole(dto.role),
    ...(mapRole(dto.role) === 'unknown' ? { rawRole: dto.role } : {}),
    content: dto.content,
    contentType: mapContentType(dto.contentType),
    ...(mapContentType(dto.contentType) === 'unknown' ? { rawContentType: dto.contentType } : {}),
    stage: mapMessageStage(dto.stage),
    ...(mapMessageStage(dto.stage) === 'unknown' ? { rawStage: dto.stage } : {}),
    ...(dto.seq !== undefined && dto.seq !== null ? { messageSequence: dto.seq } : {}),
    ...(dto.metadata !== undefined && dto.metadata !== null ? { metadata: dto.metadata } : {}),
    ...(dto.createTime !== undefined && dto.createTime !== null
      ? { createdAt: dto.createTime }
      : {}),
  } satisfies ResearchMessage;

  return message;
}

function projectEventSeq(seq: number, eventName: string): number {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new ResearchError('contract-invalid', `${eventName}.seq must be a positive integer.`);
  }
  return seq;
}

function eventProjectId(projectId: string | undefined, expectedProjectId?: string): string {
  const resolvedProjectId = projectId ?? expectedProjectId;
  if (!resolvedProjectId) {
    throw new ResearchError('contract-invalid', 'Research event is missing projectId.');
  }
  if (expectedProjectId && resolvedProjectId !== expectedProjectId) {
    throw new ResearchError(
      'contract-invalid',
      'Research event projectId does not match subscription.',
    );
  }
  return resolvedProjectId;
}

export function mapResearchSseEvent(
  dto: ResearchSseEventDto,
  expectedProjectId?: string,
): ResearchEvent {
  if (dto.event === 'heartbeat') {
    return { type: 'heartbeat', seq: 0 };
  }
  if (dto.event === 'done') {
    const projectId =
      dto.data.projectId === undefined
        ? undefined
        : eventProjectId(dto.data.projectId, expectedProjectId);
    return {
      type: 'done',
      ...(projectId ? { projectId } : {}),
      seq: -1,
      ...(dto.data.message ? { message: dto.data.message } : {}),
    };
  }
  if (dto.event === 'message') {
    const projectId = eventProjectId(dto.data.projectId ?? undefined, expectedProjectId);
    const message = mapMessageVOToResearchMessage(dto.data);
    return {
      type: 'message',
      projectId,
      message: { ...message, projectId },
      ...(message.messageSequence !== undefined
        ? { messageSequence: message.messageSequence }
        : {}),
    };
  }

  const projectId = eventProjectId(dto.data.projectId, expectedProjectId);
  const seq = projectEventSeq(dto.data.seq, dto.event);

  if (dto.event === 'agent_completed') {
    return {
      type: dto.event,
      projectId,
      agentId: dto.data.agentRunId,
      agentType: dto.data.agentName,
      ...(dto.data.displayName ? { displayName: dto.data.displayName } : {}),
      ...(dto.data.progress !== undefined
        ? { progressPercent: mapProgress(dto.data.progress, 'agent_completed.progress') }
        : {}),
      seq,
    };
  }

  if (dto.event === 'workflow_completed') {
    return { type: dto.event, projectId, seq };
  }

  if (dto.event === 'agent_status') {
    const status = mapAgentStatus(dto.data.status);
    return {
      type: dto.event,
      projectId,
      agentId: dto.data.agentRunId,
      agentType: dto.data.agentName,
      status: status.status,
      ...(status.rawStatus ? { rawStatus: status.rawStatus } : {}),
      ...(dto.data.progress !== undefined
        ? { progressPercent: mapProgress(dto.data.progress, 'agent_status.progress') }
        : {}),
      ...(dto.data.displayName ? { displayName: dto.data.displayName } : {}),
      seq,
    };
  }

  if (dto.event === 'agent_progress') {
    const progressPercent = mapProgress(dto.data.progress, 'agent_progress.progress');
    if (progressPercent === undefined) {
      throw new ResearchError('contract-invalid', 'agent_progress.progress is required.');
    }
    return {
      type: dto.event,
      projectId,
      agentId: dto.data.agentRunId,
      agentType: dto.data.agentName,
      progressPercent,
      ...(dto.data.displayName ? { displayName: dto.data.displayName } : {}),
      ...(dto.data.summary ? { summary: dto.data.summary } : {}),
      ...(dto.data.title ? { title: dto.data.title } : {}),
      ...(dto.data.eventType ? { eventType: dto.data.eventType } : {}),
      ...(dto.data.skillName ? { skillName: dto.data.skillName } : {}),
      ...(dto.data.visibility ? { visibility: dto.data.visibility } : {}),
      ...(dto.data.sourceRefs ? { sourceRefs: dto.data.sourceRefs } : {}),
      ...(dto.data.timestamp ? { timestamp: dto.data.timestamp } : {}),
      seq,
    };
  }

  if (dto.event === 'agent_summary') {
    return {
      type: dto.event,
      projectId,
      agentId: dto.data.agentRunId,
      agentType: dto.data.agentName,
      summary: dto.data.summary,
      seq,
    };
  }

  const projectStatus = mapProjectStatus(dto.data.status);
  return {
    type: dto.event,
    projectId,
    status: projectStatus.status,
    ...(projectStatus.rawStatus ? { rawStatus: projectStatus.rawStatus } : {}),
    ...(dto.data.progress !== undefined
      ? { progressPercent: mapProgress(dto.data.progress, 'project_status.progress') }
      : {}),
    seq,
  };
}

export function createUnavailableAgentReport(
  projectId: string,
  agentId: string,
  agentType: string,
  status: ResearchAgentStatus,
  rawStatus?: string,
  details?: string,
): AgentReport {
  return {
    projectId,
    agentId,
    agentType,
    status,
    ...(rawStatus ? { rawStatus } : {}),
    reportStatus: 'unavailable',
    reportReady: false,
    ...(details ? { errorMessage: details } : {}),
  };
}

export const RESEARCH_API_CONCURRENCY_DIAGNOSTIC = MAX_CONCURRENT_RESEARCH_AGENTS;
