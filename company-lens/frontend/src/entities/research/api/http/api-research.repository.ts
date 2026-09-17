import {
  getApiLanguageHeaders,
  getAuthToken,
  isApiError,
  request,
  type RequestConfig,
} from '../../../../shared/api';
import { runtimeConfig } from '../../../../shared/config';
import { DEVICE_ID_HEADER, getDeviceId } from '../../../../shared/identity';
import { ResearchError, isResearchError } from '../../model/research.errors';
import type {
  AgentReport,
  ConfirmResearchResolutionCommand,
  CreateResearchCommand,
  ResearchEventHandlers,
  ResearchEventSubscription,
  ResearchMessage,
  ResearchProject,
  StockCandidate,
} from '../../model/research.types';
import {
  mapAgentResultVOToAgentReport,
  mapFinalistVOToCompany,
  mapMessageVOToResearchMessage,
  mapProjectVOToSnapshot,
  mapResearchSseEvent,
} from './research.mapper';
import {
  parseAgentResultVO,
  parseFinalistVO,
  parseMessageVO,
  parsePageResultDto,
  parseProjectVO,
  parseResearchSseEvent,
  parseResultDto,
  parseStockInfoList,
  type ResearchSseEventDto,
} from './research.dto';
import type { ResearchRepository } from '../research.repository';

const STREAM_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_RECONNECT_DELAY_MS = 250;

type RequestFunction = <TResponse = unknown, TData = unknown>(
  config: RequestConfig<TData>,
) => Promise<TResponse>;

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ApiResearchRepositoryOptions = {
  request?: RequestFunction;
  fetch?: FetchFunction;
  reconnectDelayMs?: number;
  streamTimeoutMs?: number;
  apiBaseUrl?: string;
};

export const RESEARCH_API_PATHS = {
  create: '/v1/research-projects',
  confirm: (projectId: string) => `/v1/research-projects/${encodeURIComponent(projectId)}/confirm`,
  list: '/v1/research-projects?page=1&size=100&sort=create_time&order=desc',
  project: (projectId: string) => `/v1/research-projects/${encodeURIComponent(projectId)}`,
  messages: (conversationId: string) =>
    `/v1/conversations/${encodeURIComponent(conversationId)}/messages?page=1&size=100&sort=create_time&order=asc`,
  retry: (projectId: string) => `/v1/research-projects/${encodeURIComponent(projectId)}/retry`,
  report: (projectId: string, agentId: string) =>
    `/v1/research-projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/report`,
  finalist: (projectId: string, rankNo: string) =>
    `/v1/research-projects/${encodeURIComponent(projectId)}/finalists/${encodeURIComponent(rankNo)}`,
  events: (projectId: string, afterSeq: number, deviceId: string) =>
    `/v1/research-projects/${encodeURIComponent(projectId)}/events?afterSeq=${afterSeq}&deviceId=${encodeURIComponent(deviceId)}`,
  stockSearch: (keyword: string) => `/v1/stocks/search?keyword=${encodeURIComponent(keyword)}`,
} as const;

function resolveApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function normalizeApiResearchError(
  error: unknown,
  context: string,
  isRetry = false,
): ResearchError {
  if (isResearchError(error)) {
    return error;
  }

  if (isApiError(error)) {
    if (error.status === 404) {
      return new ResearchError('not-found', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
        details: error.details,
      });
    }
    if (error.status === 401) {
      return new ResearchError('unauthorized', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
        details: error.details,
      });
    }
    if (error.status === 403) {
      return new ResearchError('forbidden', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
        details: error.details,
      });
    }
    if (isRetry && (error.status === 400 || error.status === 409)) {
      return new ResearchError('retry-not-allowed', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
        details: error.details,
      });
    }
    return new ResearchError('request-failed', error.message, {
      status: error.status,
      apiCode: error.code,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      details: error.details,
    });
  }

  if (context === 'Research event' && error instanceof SyntaxError) {
    return new ResearchError('contract-invalid', 'Research event data is not valid JSON.');
  }

  return new ResearchError(
    'request-failed',
    error instanceof Error ? error.message : `${context} request failed.`,
  );
}

function mapStockSourceToMarket(source: string): 'US' | 'HK' {
  switch (source.trim().toLowerCase()) {
    case 'us':
      return 'US';
    case 'hk':
      return 'HK';
    default:
      throw new ResearchError(
        'contract-invalid',
        `Stock search returned unsupported source: ${source}`,
      );
  }
}

function unwrapAndParse<T>(payload: unknown, parseData: (data: unknown) => T, context: string): T {
  const envelope = parseResultDto(payload);
  if (envelope.code !== 200) {
    throw new ResearchError(
      'request-failed',
      envelope.message ?? envelope.msg ?? `${context} returned code ${envelope.code}.`,
      {
        apiCode: envelope.code,
        ...(envelope.errorCode ? { errorCode: envelope.errorCode } : {}),
      },
    );
  }
  if (envelope.data === null || envelope.data === undefined) {
    throw new ResearchError('contract-invalid', `${context} returned empty data.`);
  }
  return parseData(envelope.data);
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof globalThis.fetch !== 'function') {
    return Promise.reject(
      new ResearchError('contract-unavailable', 'Authenticated fetch is unavailable.'),
    );
  }
  return globalThis.fetch(input, init);
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

function parseSseBlock(block: string): { eventName: string; data: string } | undefined {
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of block.replace(/\r/g, '').split('\n')) {
    if (line.startsWith(':')) {
      continue;
    }
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') {
      eventName = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  return dataLines.length > 0 ? { eventName, data: dataLines.join('\n') } : undefined;
}

export function parseSseTextChunk(
  buffer: string,
  onBlock: (block: { eventName: string; data: string }) => void,
): string {
  let remaining = buffer.replace(/\r\n/g, '\n');
  let separatorIndex = remaining.indexOf('\n\n');

  while (separatorIndex >= 0) {
    const block = parseSseBlock(remaining.slice(0, separatorIndex));
    if (block) {
      onBlock(block);
    }
    remaining = remaining.slice(separatorIndex + 2);
    separatorIndex = remaining.indexOf('\n\n');
  }

  return remaining;
}

async function consumeSseResponse(
  response: Response,
  onBlock: (block: { eventName: string; data: string }) => void,
): Promise<void> {
  if (!response.ok) {
    throw new ResearchError('request-failed', `SSE request failed with HTTP ${response.status}.`, {
      status: response.status,
    });
  }
  if (!response.body) {
    throw new ResearchError('contract-invalid', 'SSE response does not contain a readable body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    buffer += decoder.decode(chunk.value, { stream: true });
    buffer = parseSseTextChunk(buffer, onBlock);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const block = parseSseBlock(buffer);
    if (block) {
      onBlock(block);
    }
  }
}

export function createApiResearchRepository(
  options: ApiResearchRepositoryOptions = {},
): ResearchRepository {
  const requestFn = options.request ?? request;
  const fetchFn = options.fetch ?? defaultFetch;
  const reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const streamTimeoutMs = options.streamTimeoutMs ?? STREAM_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl ?? runtimeConfig.api.baseUrl;
  const cursorByProjectId = new Map<string, number>();

  async function listProjects(): Promise<readonly ResearchProject[]> {
    try {
      const payload = await requestFn<unknown>({ method: 'GET', url: RESEARCH_API_PATHS.list });
      return unwrapAndParse(
        payload,
        (data) =>
          parsePageResultDto(data, parseProjectVO).records.map(
            (project) => mapProjectVOToSnapshot(project).project,
          ),
        'Research project list',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Research project list');
    }
  }

  async function searchStockCandidates(query: string): Promise<readonly StockCandidate[]> {
    const keyword = query.trim();
    if (!keyword) {
      return [];
    }
    try {
      const payload = await requestFn<unknown>({
        method: 'GET',
        url: RESEARCH_API_PATHS.stockSearch(keyword),
      });
      return unwrapAndParse(payload, parseStockInfoList, 'Stock search').map((stock) => ({
        stockId: `${stock.source}:${stock.transCode}`,
        companyName: stock.name,
        symbol: stock.transCode,
        market: mapStockSourceToMarket(stock.source),
        exchange: stock.primaryExchange || stock.source.toUpperCase(),
      }));
    } catch (error) {
      throw normalizeApiResearchError(error, 'Stock search');
    }
  }

  async function createResearch(command: CreateResearchCommand): Promise<ResearchProject> {
    if (!command.query.trim()) {
      throw new ResearchError('contract-invalid', 'Research query cannot be empty.');
    }

    try {
      const payload = await requestFn<unknown>({
        method: 'POST',
        url: RESEARCH_API_PATHS.create,
        data: {
          query: command.query.trim(),
          market: command.selectedMarket,
          ...(command.selectedStock
            ? { objectType: 'COMPANY', normalizedName: command.selectedStock.companyName }
            : {}),
        },
      });
      return unwrapAndParse(
        payload,
        (data) => mapProjectVOToSnapshot(parseProjectVO(data)).project,
        'Research project creation',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Research project creation');
    }
  }

  async function confirmResearchResolution(
    command: ConfirmResearchResolutionCommand,
  ): Promise<ResearchProject> {
    if (!command.projectId.trim()) {
      throw new ResearchError('contract-invalid', 'Project id is required to confirm resolution.');
    }

    try {
      const payload = await requestFn<unknown>({
        method: 'POST',
        url: RESEARCH_API_PATHS.confirm(command.projectId),
        data: {
          resolution: command.resolution,
          market: command.market,
        },
      });
      return unwrapAndParse(
        payload,
        (data) => mapProjectVOToSnapshot(parseProjectVO(data)).project,
        'Research preflight confirmation',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Research preflight confirmation');
    }
  }

  async function getProjectSnapshot(projectId: string) {
    if (!projectId) {
      throw new ResearchError('not-found', 'Project id is required.');
    }

    try {
      const payload = await requestFn<unknown>({
        method: 'GET',
        url: RESEARCH_API_PATHS.project(projectId),
      });
      return unwrapAndParse(
        payload,
        (data) => mapProjectVOToSnapshot(parseProjectVO(data)),
        'Project detail',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Project detail');
    }
  }

  async function getConversationMessages(
    conversationId: string,
  ): Promise<readonly ResearchMessage[]> {
    if (!conversationId) {
      return [];
    }
    try {
      const payload = await requestFn<unknown>({
        method: 'GET',
        url: RESEARCH_API_PATHS.messages(conversationId),
      });
      return unwrapAndParse(
        payload,
        (data) =>
          parsePageResultDto(data, parseMessageVO).records.map(mapMessageVOToResearchMessage),
        'Conversation messages',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Conversation messages');
    }
  }

  async function getAgentReport(projectId: string, agentId: string): Promise<AgentReport> {
    try {
      const payload = await requestFn<unknown>({
        method: 'GET',
        url: RESEARCH_API_PATHS.report(projectId, agentId),
      });
      return unwrapAndParse(
        payload,
        (data) => mapAgentResultVOToAgentReport(projectId, parseAgentResultVO(data)),
        'Agent report',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Agent report');
    }
  }

  async function getCompany(projectId: string, companyId: string) {
    if (!/^\d+$/.test(companyId)) {
      throw new ResearchError('not-found', 'Finalist rank must be a positive integer.');
    }
    try {
      const payload = await requestFn<unknown>({
        method: 'GET',
        url: RESEARCH_API_PATHS.finalist(projectId, companyId),
      });
      return unwrapAndParse(
        payload,
        (data) => mapFinalistVOToCompany(projectId, companyId, parseFinalistVO(data)),
        'Finalist detail',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Finalist detail');
    }
  }

  async function retryAgent(projectId: string, agentType: string) {
    if (!projectId || !agentType) {
      throw new ResearchError('retry-not-allowed', 'Project id and agent type are required.');
    }

    try {
      const snapshot = await getProjectSnapshot(projectId);
      const agent = snapshot.progress.agentTasks.find(
        (candidate) => candidate.agentType === agentType,
      );
      if (!agent || !agent.canRetry) {
        throw new ResearchError(
          'retry-not-allowed',
          `Agent ${agentType} is not eligible for retry in project ${projectId}.`,
        );
      }
      const payload = await requestFn<unknown>({
        method: 'POST',
        url: RESEARCH_API_PATHS.retry(projectId),
        data: { agentNames: [agentType] },
      });
      return unwrapAndParse(
        payload,
        (data) => mapProjectVOToSnapshot(parseProjectVO(data)),
        'Agent retry',
      );
    } catch (error) {
      throw normalizeApiResearchError(error, 'Agent retry', true);
    }
  }

  function subscribeProjectEvents(
    projectId: string,
    afterSeq: number,
    handlers: ResearchEventHandlers,
  ): ResearchEventSubscription {
    let active = true;
    let controller: AbortController | undefined;
    let streamTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let resolveReconnect: (() => void) | undefined;
    let cursor = Math.max(afterSeq, cursorByProjectId.get(projectId) ?? 0);

    const waitForReconnect = () =>
      new Promise<void>((resolve) => {
        resolveReconnect = resolve;
        reconnectTimer = globalThis.setTimeout(() => {
          reconnectTimer = undefined;
          resolveReconnect = undefined;
          resolve();
        }, reconnectDelayMs);
      });

    const handleEventBlock = (block: { eventName: string; data: string }) => {
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(block.data) as unknown;
        const dto = parseResearchSseEvent(block.eventName, parsedData);
        const event = mapResearchSseEvent(dto, projectId);
        if (event.type !== 'message' && event.type !== 'heartbeat' && event.type !== 'done') {
          cursor = Math.max(cursor, event.seq);
          cursorByProjectId.set(projectId, cursor);
        }
        handlers.onEvent?.(event);
        if (event.type === 'done') {
          active = false;
        }
      } catch (error) {
        handlers.onError?.(normalizeApiResearchError(error, 'Research event'));
      }
    };

    const run = async () => {
      while (active) {
        try {
          controller = new AbortController();
          streamTimer = globalThis.setTimeout(() => controller?.abort(), streamTimeoutMs);
          const streamPath = RESEARCH_API_PATHS.events(projectId, cursor, getDeviceId());
          const response = await fetchFn(resolveApiUrl(apiBaseUrl, streamPath), {
            method: 'GET',
            headers: streamHeaders(),
            signal: controller.signal,
          });
          await consumeSseResponse(response, handleEventBlock);
          if (active) {
            await waitForReconnect();
          }
        } catch (error) {
          if (active) {
            handlers.onError?.(normalizeApiResearchError(error, 'Research event stream'));
            await waitForReconnect();
          }
        } finally {
          if (streamTimer !== undefined) {
            globalThis.clearTimeout(streamTimer);
            streamTimer = undefined;
          }
          controller = undefined;
        }
      }
    };

    void run();

    return {
      unsubscribe: () => {
        active = false;
        controller?.abort();
        if (streamTimer !== undefined) {
          globalThis.clearTimeout(streamTimer);
          streamTimer = undefined;
        }
        if (reconnectTimer !== undefined) {
          globalThis.clearTimeout(reconnectTimer);
          reconnectTimer = undefined;
        }
        resolveReconnect?.();
        resolveReconnect = undefined;
      },
    };
  }

  return {
    listProjects,
    searchStockCandidates,
    createResearch,
    confirmResearchResolution,
    getProjectSnapshot,
    getConversationMessages,
    getAgentReport,
    getCompany,
    retryAgent,
    subscribeProjectEvents,
  };
}

export const apiResearchRepository = createApiResearchRepository();

export type { ResearchSseEventDto };
