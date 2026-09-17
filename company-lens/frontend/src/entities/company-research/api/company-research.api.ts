import {
  getApiLanguageHeaders,
  getAuthToken,
  isApiError,
  request,
  type RequestConfig,
} from '../../../shared/api';
import { runtimeConfig } from '../../../shared/config';
import { DEVICE_ID_HEADER, getDeviceId } from '../../../shared/identity';
import { CompanyResearchError } from '../model/company-research.errors';
import type {
  CompanyResearchEvent,
  CompanyResearchLanguage,
} from '../model/company-research.types';
import {
  parseCompanyResearchReportDocument,
  parseCompanyResearchCapabilityResult,
  parseCompanyResearchHistoryPage,
  parseCompanyResearchRecognition,
  parseCompanyResearchTask,
  parseSuccessPayload,
} from './company-research.dto';
import type {
  CompanyResearchRepository,
  CompanyResearchTaskQueryOptions,
} from './company-research.repository';

type RequestFunction = <TResponse = unknown, TData = unknown>(
  config: RequestConfig<TData>,
) => Promise<TResponse>;

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CompanyResearchApiOptions = Readonly<{
  request?: RequestFunction;
  fetch?: FetchFunction;
  apiBaseUrl?: string;
  reconnectDelayMs?: number;
}>;

export const COMPANY_RESEARCH_API_PATHS = {
  recognitions: '/v1/research/recognitions',
  recognitionStream: (query: string, language: CompanyResearchLanguage = 'zh-CN') =>
    `/v1/research/recognitions?query=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}`,
  tasks: '/v1/research/tasks',
  task: (taskId: string) => `/v1/research/tasks/${encodeURIComponent(taskId)}`,
  report: (taskId: string) => `/v1/research/tasks/${encodeURIComponent(taskId)}/report`,
  capabilityResult: (taskId: string, capability: string) =>
    `/v1/research/tasks/${encodeURIComponent(taskId)}/capabilities/${encodeURIComponent(capability)}`,
  retry: (taskId: string) => `/v1/research/tasks/${encodeURIComponent(taskId)}/retry`,
  retryReport: (taskId: string) => `/v1/research/tasks/${encodeURIComponent(taskId)}/retry-report`,
  history: '/v1/research/history',
  historyItem: (taskId: string) => `/v1/research/history/${encodeURIComponent(taskId)}`,
  bind: (taskId: string) => `/v1/research/tasks/${encodeURIComponent(taskId)}/bind`,
  events: (taskId: string, afterSeq: number) =>
    `/v1/research/tasks/${encodeURIComponent(taskId)}/events?afterSeq=${afterSeq}`,
} as const;

export function toRetryCapabilityName(name: string): string {
  return name.trim().replace(/_agent$/, '');
}

function normalizeReportRetryErrorCode(error: {
  status?: number;
  errorCode?: string;
}): 'report-retry-not-allowed' | 'report-retry-conflict' | 'report-retry-failed' {
  switch (error.errorCode) {
    case 'REPORT_NOT_RETRYABLE':
      return 'report-retry-not-allowed';
    case 'REPORT_RETRY_CONFLICT':
      return 'report-retry-conflict';
    case 'REPORT_RETRY_FAILED':
      return 'report-retry-failed';
    default:
      if (error.status === 409) return 'report-retry-conflict';
      if (error.status === 422) return 'report-retry-not-allowed';
      return 'report-retry-failed';
  }
}

function normalizeError(
  error: unknown,
  options?: { isRetry?: boolean; isReportRetry?: boolean },
): CompanyResearchError {
  if (error instanceof CompanyResearchError) {
    return error;
  }
  if (isApiError(error)) {
    const code = options?.isReportRetry
      ? normalizeReportRetryErrorCode(error)
      : error.status === 404
        ? 'not-found'
        : error.status === 401
          ? 'unauthorized'
          : error.status === 403
            ? 'forbidden'
            : options?.isRetry && (error.status === 400 || error.status === 409)
              ? 'retry-not-allowed'
              : 'request-failed';
    return new CompanyResearchError(code, error.message, {
      status: error.status,
      apiCode: error.code,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      details: error.details,
    });
  }
  return new CompanyResearchError(
    options?.isReportRetry ? 'report-retry-failed' : 'request-failed',
    error instanceof Error ? error.message : 'Company research request failed.',
  );
}

function resolveApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function streamHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    Accept: 'text/event-stream',
    ...getApiLanguageHeaders(),
    [DEVICE_ID_HEADER]: getDeviceId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type SseBlock = Readonly<{ eventName: string; data: string; id?: string }>;

function parseSseBlock(value: string): SseBlock | undefined {
  let eventName = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];
  for (const line of value.replace(/\r/g, '').split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const fieldValue = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') eventName = fieldValue;
    if (field === 'data') dataLines.push(fieldValue);
    if (field === 'id') id = fieldValue;
  }
  return dataLines.length ? { eventName, data: dataLines.join('\n'), id } : undefined;
}

function optionalEventId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalEventSeq(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : undefined;
  return parsed !== undefined && Number.isInteger(parsed) && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function optionalEventProgress(value: unknown): number | undefined {
  const parsed = optionalEventSeq(value);
  return parsed !== undefined && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

function optionalEventString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalEventSourceRefs(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value.flatMap((item) =>
    typeof item === 'string' && item.trim() ? [item.trim()] : [],
  );
  return refs.length > 0 ? refs : undefined;
}

export function parseCompanyResearchSseChunk(
  buffer: string,
  onBlock: (block: SseBlock) => void,
): string {
  let remaining = buffer.replace(/\r\n/g, '\n');
  let separator = remaining.indexOf('\n\n');
  while (separator >= 0) {
    const block = parseSseBlock(remaining.slice(0, separator));
    if (block) onBlock(block);
    remaining = remaining.slice(separator + 2);
    separator = remaining.indexOf('\n\n');
  }
  return remaining;
}

function parseEvent(block: SseBlock): CompanyResearchEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(block.data);
  } catch {
    throw new CompanyResearchError('contract-invalid', 'SSE event data is not valid JSON.');
  }
  const record =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const payloadSeq = optionalEventSeq(record.seq);
  const idSeq = optionalEventSeq(block.id);
  const payloadType = optionalEventString(record.type)?.toLowerCase();
  const eventName =
    block.eventName.toLowerCase() === 'message' && payloadType
      ? payloadType
      : block.eventName.toLowerCase();
  const taskId =
    optionalEventId(record.taskId) ??
    optionalEventId(record.projectId) ??
    optionalEventId(record.task_id) ??
    optionalEventId(record.project_id);
  const conversationId =
    optionalEventId(record.conversationId) ?? optionalEventId(record.conversation_id);
  const query = optionalEventString(record.query);
  const recognitionId =
    optionalEventId(record.recognitionId) ?? optionalEventId(record.recognition_id);
  const status = optionalEventString(record.status);
  const message = optionalEventString(record.message) ?? optionalEventString(record.error_summary);
  const failReason =
    optionalEventString(record.failReason) ?? optionalEventString(record.fail_reason);
  const selectedCandidateId =
    optionalEventId(record.selectedCandidateId) ?? optionalEventId(record.selected_candidate_id);
  const recognition =
    eventName === 'recognition_result' ? parseCompanyResearchRecognition(record) : undefined;
  const agentRunId = optionalEventId(record.agentRunId);
  const agentName = optionalEventString(record.agentName) ?? optionalEventString(record.name);
  const displayName = optionalEventString(record.displayName);
  const progress = optionalEventProgress(record.progress);
  const summary = optionalEventString(record.summary);
  const summaryZh = optionalEventString(record.summaryZh) ?? optionalEventString(record.summary_zh);
  const summaryEn = optionalEventString(record.summaryEn) ?? optionalEventString(record.summary_en);
  const title = optionalEventString(record.title);
  const titleZh = optionalEventString(record.titleZh) ?? optionalEventString(record.title_zh);
  const titleEn = optionalEventString(record.titleEn) ?? optionalEventString(record.title_en);
  const reportMarkdown =
    optionalEventString(record.reportMarkdown) ?? optionalEventString(record.report_markdown);
  const reportMarkdownZh =
    optionalEventString(record.reportMarkdownZh) ?? optionalEventString(record.report_markdown_zh);
  const reportMarkdownEn =
    optionalEventString(record.reportMarkdownEn) ?? optionalEventString(record.report_markdown_en);
  const eventType = optionalEventString(record.eventType);
  const skillName = optionalEventString(record.skillName);
  const visibility = optionalEventString(record.visibility);
  const sourceRefs = optionalEventSourceRefs(record.sourceRefs);
  return {
    type: eventName,
    taskId,
    seq: payloadSeq ?? idSeq,
    isTerminal: ['task_complete', 'task_partial', 'task_failed', 'done'].includes(eventName),
    ...(conversationId ? { conversationId } : {}),
    ...(query ? { query } : {}),
    ...(recognitionId ? { recognitionId } : {}),
    ...(status ? { status } : {}),
    ...(message ? { message } : {}),
    ...(failReason ? { failReason } : {}),
    ...(selectedCandidateId ? { selectedCandidateId } : {}),
    ...(recognition ? { recognition } : {}),
    ...(agentRunId ? { agentRunId } : {}),
    ...(agentName ? { agentName } : {}),
    ...(displayName ? { displayName } : {}),
    ...(progress !== undefined ? { progress } : {}),
    ...(summary ? { summary } : {}),
    ...(summaryZh ? { summaryZh } : {}),
    ...(summaryEn ? { summaryEn } : {}),
    ...(title ? { title } : {}),
    ...(titleZh ? { titleZh } : {}),
    ...(titleEn ? { titleEn } : {}),
    ...(reportMarkdown ? { reportMarkdown } : {}),
    ...(reportMarkdownZh ? { reportMarkdownZh } : {}),
    ...(reportMarkdownEn ? { reportMarkdownEn } : {}),
    ...(eventType ? { eventType } : {}),
    ...(skillName ? { skillName } : {}),
    ...(visibility ? { visibility } : {}),
    ...(sourceRefs ? { sourceRefs } : {}),
  };
}

async function consumeStream(
  response: Response,
  onEvent: (event: CompanyResearchEvent) => void,
): Promise<boolean> {
  if (!response.ok) {
    throw new CompanyResearchError(
      'request-failed',
      `SSE request failed with HTTP ${response.status}.`,
      { status: response.status },
    );
  }
  if (!response.body) {
    throw new CompanyResearchError('contract-invalid', 'SSE response has no readable body.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal = false;
  while (!terminal) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    buffer = parseCompanyResearchSseChunk(buffer, (block) => {
      const event = parseEvent(block);
      terminal = event.isTerminal;
      onEvent(event);
    });
  }
  if (terminal) {
    await reader.cancel().catch(() => undefined);
  }
  return terminal;
}

function delay(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(resolve, durationMs);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });
}

export function createCompanyResearchApi(
  options: CompanyResearchApiOptions = {},
): CompanyResearchRepository {
  const requestFn = options.request ?? request;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const apiBaseUrl = options.apiBaseUrl ?? runtimeConfig.api.baseUrl;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1000;

  return {
    subscribeRecognition(query, handlers, language = 'zh-CN') {
      const controller = new AbortController();
      void (async () => {
        try {
          const response = await fetchFn(
            resolveApiUrl(
              apiBaseUrl,
              COMPANY_RESEARCH_API_PATHS.recognitionStream(query, language),
            ),
            { headers: streamHeaders(), signal: controller.signal },
          );
          const terminal = await consumeStream(response, handlers.onEvent);
          if (!terminal && !controller.signal.aborted) {
            throw new CompanyResearchError(
              'request-failed',
              'Recognition SSE ended before completion.',
            );
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            handlers.onError?.(normalizeError(error));
          }
        }
      })();
      return { close: () => controller.abort() };
    },
    async createTask(input) {
      try {
        const payload = await requestFn<unknown>({
          method: 'POST',
          url: COMPANY_RESEARCH_API_PATHS.tasks,
          data: input,
        });
        return parseSuccessPayload(payload, parseCompanyResearchTask);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    async getTask(taskId, options?: CompanyResearchTaskQueryOptions) {
      try {
        const includeMessages = options?.includeMessages;
        const payload = await requestFn<unknown>({
          method: 'GET',
          url: COMPANY_RESEARCH_API_PATHS.task(taskId),
          ...(includeMessages !== undefined ? { params: { includeMessages } } : {}),
        });
        return parseSuccessPayload(payload, parseCompanyResearchTask);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    async getReport(taskId) {
      try {
        const payload = await requestFn<unknown>({
          method: 'GET',
          url: COMPANY_RESEARCH_API_PATHS.report(taskId),
        });
        return parseSuccessPayload(payload, parseCompanyResearchReportDocument);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    async getCapabilityResult(taskId, capability) {
      try {
        const payload = await requestFn<unknown>({
          method: 'GET',
          url: COMPANY_RESEARCH_API_PATHS.capabilityResult(taskId, capability),
        });
        return parseSuccessPayload(payload, parseCompanyResearchCapabilityResult);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    async retryCapability(taskId, capability) {
      try {
        await requestFn<unknown>({
          method: 'POST',
          url: COMPANY_RESEARCH_API_PATHS.retry(taskId),
          data: { capability: toRetryCapabilityName(capability) },
        });
      } catch (error) {
        throw normalizeError(error, { isRetry: true });
      }
    },
    async retryReport(taskId) {
      try {
        await requestFn<unknown>({
          method: 'POST',
          url: COMPANY_RESEARCH_API_PATHS.retryReport(taskId),
        });
      } catch (error) {
        throw normalizeError(error, { isReportRetry: true });
      }
    },
    async listHistory(input) {
      try {
        const payload = await requestFn<unknown>({
          method: 'GET',
          url: COMPANY_RESEARCH_API_PATHS.history,
          params: input,
        });
        return parseSuccessPayload(payload, parseCompanyResearchHistoryPage);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    async deleteHistory(taskId) {
      try {
        await requestFn<unknown>({
          method: 'DELETE',
          url: COMPANY_RESEARCH_API_PATHS.historyItem(taskId),
        });
      } catch (error) {
        throw normalizeError(error);
      }
    },
    async bindTask(taskId) {
      try {
        await requestFn<unknown>({
          method: 'POST',
          url: COMPANY_RESEARCH_API_PATHS.bind(taskId),
        });
      } catch (error) {
        throw normalizeError(error);
      }
    },
    subscribeEvents(taskId, handlers, afterSeq = 0) {
      const controller = new AbortController();
      let cursor = Number.isFinite(afterSeq) ? Math.max(0, Math.floor(afterSeq)) : 0;
      void (async () => {
        while (!controller.signal.aborted) {
          try {
            const response = await fetchFn(
              resolveApiUrl(apiBaseUrl, COMPANY_RESEARCH_API_PATHS.events(taskId, cursor)),
              { headers: streamHeaders(), signal: controller.signal },
            );
            const terminal = await consumeStream(response, (event) => {
              if (event.seq !== undefined && event.seq > cursor) cursor = event.seq;
              handlers.onEvent(event);
            });
            if (terminal) return;
          } catch (error) {
            if (controller.signal.aborted) return;
            handlers.onError?.(normalizeError(error));
          }
          await delay(reconnectDelayMs, controller.signal);
        }
      })();
      return { close: () => controller.abort() };
    },
  };
}
