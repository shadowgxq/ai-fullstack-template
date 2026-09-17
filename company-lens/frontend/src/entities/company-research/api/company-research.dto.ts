import { CompanyResearchError } from '../model/company-research.errors';
import type {
  CompanyResearchAgentBlock,
  CompanyResearchCapability,
  CompanyResearchCapabilityResult,
  CompanyResearchCapabilityStatus,
  CompanyResearchCandidate,
  CompanyResearchConclusion,
  CompanyResearchHistoryItem,
  CompanyResearchHistoryPage,
  CompanyResearchLanguageValue,
  CompanyResearchMessage,
  CompanyResearchRecognition,
  CompanyResearchRecognitionStatus,
  CompanyResearchReport,
  CompanyResearchReportDocument,
  CompanyResearchTask,
  CompanyResearchTaskStatus,
  JsonValue,
} from '../model/company-research.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return optionalString(value);
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function optionalInteger(value: unknown): number | undefined {
  const parsed = optionalNumber(value);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}

function optionalProgress(value: unknown): number | undefined {
  const parsed = optionalInteger(value);
  return parsed !== undefined && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalKeyPeople(value: unknown): string | undefined {
  const text = optionalString(value);
  if (text) return text;
  if (!Array.isArray(value)) return undefined;

  const people = value.flatMap((person) => {
    if (!isRecord(person)) return [];
    const name = optionalString(person.name);
    const role = optionalString(person.role);
    const label = [name, role ? `(${role})` : undefined].filter((part): part is string =>
      Boolean(part),
    );
    return label.length > 0 ? [label.join(' ')] : [];
  });

  return people.length > 0 ? people.join('; ') : undefined;
}

function requiredString(value: unknown, field: string): string {
  const parsed = optionalString(value);
  if (!parsed) {
    throw new CompanyResearchError('contract-invalid', `Task field ${field} is required.`);
  }
  return parsed;
}

function requiredId(value: unknown, field: string): string {
  const parsed = optionalId(value);
  if (!parsed) {
    throw new CompanyResearchError('contract-invalid', `Task field ${field} is required.`);
  }
  return parsed;
}

export function normalizeTaskStatus(value: unknown): CompanyResearchTaskStatus {
  switch (optionalString(value)?.toUpperCase()) {
    case 'PENDING':
      return 'pending';
    case 'RESOLVING':
      return 'resolving';
    case 'COLLECTING':
      return 'collecting';
    case 'ANALYZING':
      return 'analyzing';
    case 'SYNTHESIZING':
      return 'synthesizing';
    case 'COMPLETED':
    case 'SUCCEEDED':
      return 'completed';
    case 'PARTIAL':
    case 'PARTIAL_FAILED':
      return 'partial';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function normalizeCompanyResearchLanguage(value: unknown): CompanyResearchLanguageValue {
  switch (optionalString(value)) {
    case 'zh-CN':
      return 'zh-CN';
    case 'en-US':
      return 'en-US';
    default:
      return 'unknown';
  }
}

export function normalizeCapabilityStatus(value: unknown): CompanyResearchCapabilityStatus {
  switch (optionalString(value)?.toUpperCase()) {
    case 'PENDING':
    case 'WAITING':
      return 'pending';
    case 'RUNNING':
      return 'running';
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'COMPLETED':
      return 'succeeded';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    case 'DISABLED':
    case 'NOT_ENABLED':
      return 'disabled';
    default:
      return 'unknown';
  }
}

function parseCapability(value: unknown): CompanyResearchCapability | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const name = optionalString(value.name);
  if (!name) {
    return undefined;
  }
  const retryable = optionalBoolean(value.retryable);
  return {
    name,
    displayName: optionalString(value.displayName),
    status: normalizeCapabilityStatus(value.status),
    ...(retryable !== undefined ? { retryable } : {}),
  };
}

function parseMessage(value: unknown): CompanyResearchMessage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    id: optionalId(value.id),
    conversationId: optionalId(value.conversationId),
    projectId: optionalId(value.projectId),
    agentRunId: optionalId(value.agentRunId),
    role: optionalString(value.role),
    content: optionalString(value.content),
    contentType: optionalString(value.contentType),
    stage: optionalString(value.stage),
    seq: optionalInteger(value.seq),
    metadata: parseJsonField(value.metadata),
    createTime: optionalString(value.createTime),
  };
}

function parseAgentBlock(value: unknown): CompanyResearchAgentBlock | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const agentName = optionalString(value.agentName);
  if (!agentName) {
    return undefined;
  }
  const messages = Array.isArray(value.messages)
    ? value.messages.flatMap((message) => {
        const parsed = parseMessage(message);
        return parsed ? [parsed] : [];
      })
    : [];
  const retryable = optionalBoolean(value.retryable);
  return {
    agentRunId: optionalId(value.agentRunId),
    agentName,
    displayName: optionalString(value.displayName),
    skillName: optionalString(value.skillName),
    eventAgentName: optionalString(value.eventAgentName),
    status: normalizeCapabilityStatus(value.status),
    ...(retryable !== undefined ? { retryable } : {}),
    seq: optionalInteger(value.seq),
    progress: optionalProgress(value.progress),
    summary: optionalString(value.summary),
    errorMessage: optionalString(value.errorMessage),
    confidence: optionalNumber(value.confidence),
    startedAt: optionalString(value.startedAt),
    completedAt: optionalString(value.completedAt),
    messages,
  };
}

function parseConclusion(value: unknown): CompanyResearchConclusion | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const conclusion = {
    decision: optionalString(value.decision),
    confidence: optionalString(value.confidence),
    companyQuality: optionalString(value.companyQuality),
    valuationStatus: optionalString(value.valuationStatus),
    longTermOutlook: optionalString(value.longTermOutlook),
    biggestOpportunity:
      optionalString(value.maximumOpportunity) ??
      optionalString(value.maximum_opportunity) ??
      optionalString(value.biggestOpportunity) ??
      optionalString(value.biggest_opportunity),
    biggestOpportunityZh:
      optionalString(value.maximumOpportunityZh) ??
      optionalString(value.maximum_opportunity_zh) ??
      optionalString(value.biggestOpportunityZh) ??
      optionalString(value.biggest_opportunity_zh),
    biggestOpportunityEn:
      optionalString(value.maximumOpportunityEn) ??
      optionalString(value.maximum_opportunity_en) ??
      optionalString(value.biggestOpportunityEn) ??
      optionalString(value.biggest_opportunity_en),
    biggestRisk:
      optionalString(value.maximumRisk) ??
      optionalString(value.maximum_risk) ??
      optionalString(value.biggestRisk) ??
      optionalString(value.biggest_risk),
    biggestRiskZh:
      optionalString(value.maximumRiskZh) ??
      optionalString(value.maximum_risk_zh) ??
      optionalString(value.biggestRiskZh) ??
      optionalString(value.biggest_risk_zh),
    biggestRiskEn:
      optionalString(value.maximumRiskEn) ??
      optionalString(value.maximum_risk_en) ??
      optionalString(value.biggestRiskEn) ??
      optionalString(value.biggest_risk_en),
  };
  return Object.values(conclusion).some(Boolean) ? conclusion : undefined;
}

export function parseCompanyResearchTask(value: unknown): CompanyResearchTask {
  if (!isRecord(value)) {
    throw new CompanyResearchError('contract-invalid', 'Task response must be an object.');
  }
  const agents = Array.isArray(value.agents)
    ? value.agents.flatMap((agent) => {
        const parsed = parseAgentBlock(agent);
        return parsed ? [parsed] : [];
      })
    : [];
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.flatMap((capability) => {
        const parsed = parseCapability(capability);
        return parsed ? [parsed] : [];
      })
    : [];
  const finalResultAvailable = optionalBoolean(
    value.finalResultAvailable ?? value.final_result_available,
  );
  const synthesisFailed = optionalBoolean(value.synthesisFailed ?? value.synthesis_failed);
  return {
    taskId: requiredId(value.taskId, 'taskId'),
    query: requiredString(value.query, 'query'),
    language: normalizeCompanyResearchLanguage(value.language),
    status: normalizeTaskStatus(value.status),
    objectType: optionalString(value.objectType),
    objectName: optionalString(value.objectName),
    companyName: optionalString(value.companyName),
    stockCode: optionalString(value.stockCode),
    market: optionalString(value.market),
    exchange: optionalString(value.exchange),
    industry: optionalString(value.industry),
    industryZh: optionalString(value.industryZh) ?? optionalString(value.industry_zh),
    industryEn: optionalString(value.industryEn) ?? optionalString(value.industry_en),
    keyPeople: optionalString(value.keyPeople),
    objectRelation: optionalString(value.objectRelation),
    researchFocus: optionalString(value.researchFocus),
    reportReady: optionalBoolean(value.reportReady) ?? false,
    ...(finalResultAvailable !== undefined ? { finalResultAvailable } : {}),
    ...(synthesisFailed !== undefined ? { synthesisFailed } : {}),
    failReason: optionalString(value.failReason),
    capabilities:
      capabilities.length > 0
        ? capabilities
        : agents.map(({ agentName, displayName, status }) => ({
            name: agentName,
            displayName,
            status,
          })),
    ...(Array.isArray(value.systemMessages)
      ? {
          systemMessages: value.systemMessages.flatMap((message) => {
            const parsed = parseMessage(message);
            return parsed ? [parsed] : [];
          }),
        }
      : {}),
    ...(Array.isArray(value.agents) ? { agents } : {}),
    conclusion: parseConclusion(value.conclusion),
    canBind: optionalBoolean(value.canBind),
    isBound: optionalBoolean(value.isBound),
    createdAt: optionalString(value.createdAt),
    completedAt: optionalString(value.completedAt),
  };
}

export function normalizeRecognitionStatus(value: unknown): CompanyResearchRecognitionStatus {
  switch (optionalString(value)?.toUpperCase()) {
    case 'RESOLVED':
      return 'resolved';
    case 'AMBIGUOUS':
      return 'ambiguous';
    case 'UNSUPPORTED':
      return 'unsupported';
    case 'UNRESOLVED':
      return 'unresolved';
    default:
      return 'unknown';
  }
}

function parseCandidate(value: unknown): CompanyResearchCandidate | undefined {
  if (!isRecord(value)) return undefined;
  const company = isRecord(value.company) ? value.company : undefined;
  const candidateId = optionalId(value.candidateId) ?? optionalId(value.candidate_id);
  const objectName =
    optionalString(value.objectName) ??
    optionalString(value.object_name) ??
    optionalString(value.name);
  if (!candidateId || !objectName) return undefined;
  return {
    candidateId,
    objectName,
    normalizedObjectName:
      optionalString(value.normalizedObjectName) ?? optionalString(value.normalized_object_name),
    objectType: optionalString(value.objectType) ?? optionalString(value.object_type),
    companyName:
      optionalString(company?.name) ??
      optionalString(company?.companyName) ??
      optionalString(company?.company_name) ??
      optionalString(value.companyName) ??
      optionalString(value.company_name),
    companyLegalName:
      optionalString(company?.legalName) ??
      optionalString(company?.legal_name) ??
      optionalString(value.companyLegalName) ??
      optionalString(value.company_legal_name),
    stockCode:
      optionalString(company?.ticker) ??
      optionalString(company?.stockCode) ??
      optionalString(company?.stock_code) ??
      optionalString(value.stockCode) ??
      optionalString(value.stock_code),
    market:
      optionalString(company?.market) ??
      optionalString(value.market) ??
      optionalString(value.market_code),
    exchange: optionalString(company?.exchange) ?? optionalString(value.exchange),
    industry: optionalString(company?.industry) ?? optionalString(value.industry),
    keyPeople:
      optionalKeyPeople(company?.keyPeople) ??
      optionalKeyPeople(company?.key_people) ??
      optionalKeyPeople(value.keyPeople) ??
      optionalKeyPeople(value.key_people),
    relation: optionalString(value.relation),
    canResearch:
      optionalBoolean(value.researchable) ??
      optionalBoolean(value.isResearchable) ??
      optionalBoolean(value.is_researchable) ??
      optionalBoolean(value.canResearch) ??
      optionalBoolean(value.can_research) ??
      true,
    disabledReason:
      optionalString(value.unsupportedReason) ??
      optionalString(value.unsupported_reason) ??
      optionalString(value.disabledReason) ??
      optionalString(value.disabled_reason),
  };
}

export function parseCompanyResearchRecognition(value: unknown): CompanyResearchRecognition {
  if (!isRecord(value)) {
    throw new CompanyResearchError('contract-invalid', 'Recognition response must be an object.');
  }
  return {
    recognitionId: requiredId(value.recognitionId ?? value.recognition_id, 'recognitionId'),
    status: normalizeRecognitionStatus(value.status),
    selectedCandidateId: optionalId(value.selectedCandidateId ?? value.selected_candidate_id),
    conversationId: optionalId(value.conversationId ?? value.conversation_id),
    candidates: Array.isArray(value.candidates)
      ? value.candidates.slice(0, 5).flatMap((candidate) => {
          const parsed = parseCandidate(candidate);
          return parsed ? [parsed] : [];
        })
      : [],
    message: optionalString(value.message) ?? optionalString(value.error_summary),
  };
}

function parseHistoryItem(value: unknown): CompanyResearchHistoryItem | undefined {
  if (!isRecord(value)) return undefined;
  const taskId = optionalId(value.taskId);
  const query = optionalString(value.query);
  if (!taskId || !query) return undefined;
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.flatMap((capability) => {
        const parsed = parseCapability(capability);
        return parsed ? [parsed] : [];
      })
    : undefined;
  const finalResultAvailable = optionalBoolean(
    value.finalResultAvailable ?? value.final_result_available,
  );
  const synthesisFailed = optionalBoolean(value.synthesisFailed ?? value.synthesis_failed);
  return {
    taskId,
    query,
    objectName: optionalString(value.objectName),
    objectType: optionalString(value.objectType),
    companyName: optionalString(value.companyName),
    stockCode: optionalString(value.stockCode),
    market: optionalString(value.market),
    researchFocus: optionalString(value.researchFocus),
    status: normalizeTaskStatus(value.status),
    ...(finalResultAvailable !== undefined ? { finalResultAvailable } : {}),
    ...(synthesisFailed !== undefined ? { synthesisFailed } : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
    conclusion: parseConclusion(value.conclusion),
    createdAt: optionalString(value.createdAt),
  };
}

export function parseCompanyResearchHistoryPage(value: unknown): CompanyResearchHistoryPage {
  if (!isRecord(value)) {
    throw new CompanyResearchError('contract-invalid', 'History response must be an object.');
  }
  const rawItems = Array.isArray(value.items)
    ? value.items
    : Array.isArray(value.records)
      ? value.records
      : Array.isArray(value.content)
        ? value.content
        : [];
  const items = rawItems.flatMap((item) => {
    const parsed = parseHistoryItem(item);
    return parsed ? [parsed] : [];
  });
  const page = typeof value.page === 'number' ? value.page : 1;
  const size = typeof value.size === 'number' ? value.size : Math.max(items.length, 1);
  const total = typeof value.total === 'number' ? value.total : items.length;
  return { items, page, size, total };
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function parseCompanyResearchReport(value: unknown): CompanyResearchReport {
  if (!isRecord(value) || !isJsonValue(value)) {
    throw new CompanyResearchError('contract-invalid', 'Report response must be a JSON object.');
  }
  return value;
}

export function parseCompanyResearchReportDocument(value: unknown): CompanyResearchReportDocument {
  if (isRecord(value) && 'report' in value) {
    const reportMarkdown = optionalString(value.reportMarkdown);
    const reportMarkdownZh =
      optionalString(value.reportMarkdownZh) ?? optionalString(value.report_markdown_zh);
    const reportMarkdownEn =
      optionalString(value.reportMarkdownEn) ?? optionalString(value.report_markdown_en);
    return {
      report: parseCompanyResearchReport(value.report),
      ...(reportMarkdown ? { reportMarkdown } : {}),
      ...(reportMarkdownZh ? { reportMarkdownZh } : {}),
      ...(reportMarkdownEn ? { reportMarkdownEn } : {}),
    };
  }

  return { report: parseCompanyResearchReport(value) };
}

function parseJsonField(value: unknown): JsonValue | undefined {
  if (isJsonValue(value)) {
    if (typeof value !== 'string') return value;
    try {
      const parsed: unknown = JSON.parse(value);
      return isJsonValue(parsed) ? parsed : value;
    } catch {
      return value.trim() ? value : undefined;
    }
  }
  return undefined;
}

export function parseCompanyResearchCapabilityResult(
  value: unknown,
): CompanyResearchCapabilityResult {
  if (!isRecord(value)) {
    throw new CompanyResearchError('contract-invalid', 'Capability result must be an object.');
  }
  const reportMarkdown = optionalString(value.reportMarkdown);
  const reportMarkdownZh =
    optionalString(value.reportMarkdownZh) ?? optionalString(value.report_markdown_zh);
  const reportMarkdownEn =
    optionalString(value.reportMarkdownEn) ?? optionalString(value.report_markdown_en);
  const normalizedOutput = parseJsonField(value.normalizedOutput);
  return {
    agentName: requiredString(value.agentName, 'agentName'),
    reportReady:
      optionalBoolean(value.reportReady) ??
      hasCapabilityReportContent(
        reportMarkdownZh,
        reportMarkdownEn,
        reportMarkdown,
        normalizedOutput,
      ),
    reportMarkdown,
    ...(reportMarkdownZh ? { reportMarkdownZh } : {}),
    ...(reportMarkdownEn ? { reportMarkdownEn } : {}),
    normalizedOutput,
    sources: parseJsonField(value.sources),
  };
}

function hasCapabilityReportContent(
  reportMarkdownZh: string | undefined,
  reportMarkdownEn: string | undefined,
  reportMarkdown: string | undefined,
  normalizedOutput: JsonValue | undefined,
): boolean {
  if (reportMarkdownZh || reportMarkdownEn || reportMarkdown) return true;
  if (normalizedOutput === undefined || normalizedOutput === null) return false;
  if (typeof normalizedOutput === 'string') return normalizedOutput.trim().length > 0;
  if (Array.isArray(normalizedOutput)) return normalizedOutput.length > 0;
  if (typeof normalizedOutput === 'object') return Object.keys(normalizedOutput).length > 0;
  return true;
}

export function parseSuccessPayload<T>(payload: unknown, parseData: (value: unknown) => T): T {
  if (isRecord(payload) && typeof payload.code === 'number' && 'data' in payload) {
    if (payload.code !== 200) {
      const errorCode = optionalString(payload.errorCode);
      throw new CompanyResearchError(
        'request-failed',
        optionalString(payload.message) ??
          optionalString(payload.msg) ??
          `API returned code ${payload.code}.`,
        {
          apiCode: payload.code,
          ...(errorCode ? { errorCode } : {}),
          details: payload,
        },
      );
    }
    if (payload.data === null || payload.data === undefined) {
      throw new CompanyResearchError('contract-invalid', 'API response data is empty.');
    }
    return parseData(payload.data);
  }

  return parseData(payload);
}
