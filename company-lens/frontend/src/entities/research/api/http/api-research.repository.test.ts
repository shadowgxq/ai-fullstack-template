import { describe, expect, it, vi } from 'vitest';

import type { RequestConfig } from '../../../../shared/api';
import { getDeviceId } from '../../../../shared/identity';
import {
  createApiResearchRepository,
  parseSseTextChunk,
  RESEARCH_API_PATHS,
} from './api-research.repository';

const projectId = '2074001493837324210';
const agentId = '2074001493837324211';

const projectDto = {
  id: projectId,
  conversationId: 'conversation-1',
  query: 'AI 算力',
  objectType: 'THEME',
  market: 'US',
  status: 'FAILED',
  agents: [
    {
      id: agentId,
      agentName: 'industry_research',
      displayName: 'Industry Research',
      status: 'FAILED',
      seq: 1,
    },
  ],
  finalists: [],
};

type RequestStubOptions = {
  project?: Omit<typeof projectDto, 'conversationId'> & { conversationId?: string };
  retryError?: unknown;
};

function createRequestStub(options: RequestStubOptions = {}) {
  const requests: RequestConfig[] = [];
  const request = async <TResponse = unknown, TData = unknown>(
    config: RequestConfig<TData>,
  ): Promise<TResponse> => {
    requests.push(config);
    if (config.url === RESEARCH_API_PATHS.list) {
      return {
        code: 200,
        data: {
          total: 1,
          current: 1,
          size: 100,
          records: [options.project ?? projectDto],
        },
      } as TResponse;
    }
    if (config.url?.includes('/stocks/search')) {
      return {
        code: 200,
        data: [
          {
            source: 'us',
            transCode: 'NVDA',
            name: 'NVIDIA Corporation',
            market: 'stocks',
            primaryExchange: 'XNAS',
          },
          {
            source: 'hk',
            transCode: '00700',
            name: 'Tencent Holdings Limited',
            market: 'MAIN BOARD',
            primaryExchange: 'XHKG',
          },
        ],
      } as TResponse;
    }
    if (config.url === RESEARCH_API_PATHS.messages('conversation-1')) {
      return {
        code: 200,
        data: {
          total: 1,
          current: 1,
          size: 100,
          records: [
            {
              id: 'message-1',
              conversationId: 'conversation-1',
              projectId,
              agentRunId: agentId,
              role: 'ASSISTANT',
              content: 'Thinking',
              contentType: 'TEXT',
              stage: 'THINKING',
              metadata: { steps: [{ summary: 'Research step' }] },
            },
          ],
        },
      } as TResponse;
    }
    if (config.url?.endsWith(`/agents/${agentId}/report`)) {
      return {
        code: 200,
        data: {
          agentRunId: agentId,
          agentName: 'industry_research_agent',
          displayName: 'Industry Research',
          status: 'COMPLETED',
          summary: 'Agent summary',
          dataSources: '["annual report"]',
          confidence: 0.92,
          result: { format: ' md ', content: '# Full report' },
        },
      } as TResponse;
    }
    if (config.url?.includes('/finalists/')) {
      return {
        code: 200,
        data: {
          companyName: 'NVIDIA',
          ticker: 'NVDA',
          rankNo: 1,
          reason: 'AI leader',
          market: 'US',
          score: 92.5,
          conclusion: 'Strong position',
          strengths: '["Technology moat"]',
          risks: 'Valuation risk',
          nextSteps: 'Verify growth',
        },
      } as TResponse;
    }
    if (config.method === 'POST' && options.retryError) {
      throw options.retryError;
    }
    return { code: 200, data: options.project ?? projectDto } as TResponse;
  };
  return { request, requests };
}

function apiError(status: number): { __apiError: true; message: string; status: number } {
  return { __apiError: true, message: `HTTP ${status}`, status };
}

describe('api research repository', () => {
  it('loads conversation messages for historical thinking steps', async () => {
    const stub = createRequestStub();
    const repository = createApiResearchRepository({ request: stub.request });

    await expect(repository.getConversationMessages?.('conversation-1')).resolves.toEqual([
      expect.objectContaining({
        messageId: 'message-1',
        agentRunId: agentId,
        stage: 'THINKING',
        metadata: { steps: [{ summary: 'Research step' }] },
      }),
    ]);
    expect(stub.requests[0]).toMatchObject({
      method: 'GET',
      url: RESEARCH_API_PATHS.messages('conversation-1'),
    });
  });

  it('lists device-owned projects from the live MyBatis pagination shape', async () => {
    const repository = createApiResearchRepository({ request: createRequestStub().request });

    await expect(repository.listProjects?.()).resolves.toMatchObject([
      { projectId, query: 'AI 算力', market: 'US', status: 'failed' },
    ]);
  });

  it('searches and maps US and HK candidates without a market request parameter', async () => {
    const stub = createRequestStub();
    const repository = createApiResearchRepository({ request: stub.request });

    await expect(repository.searchStockCandidates('NVDA')).resolves.toEqual([
      {
        stockId: 'us:NVDA',
        companyName: 'NVIDIA Corporation',
        symbol: 'NVDA',
        market: 'US',
        exchange: 'XNAS',
      },
      {
        stockId: 'hk:00700',
        companyName: 'Tencent Holdings Limited',
        symbol: '00700',
        market: 'HK',
        exchange: 'XHKG',
      },
    ]);
    expect(stub.requests[0]).toMatchObject({
      method: 'GET',
      url: RESEARCH_API_PATHS.stockSearch('NVDA'),
    });
  });

  it('does not request candidates for an empty query', async () => {
    const stub = createRequestStub();
    const repository = createApiResearchRepository({ request: stub.request });

    await expect(repository.searchStockCandidates('  ')).resolves.toEqual([]);
    expect(stub.requests).toHaveLength(0);
  });

  it.each([
    ['US', 'US'],
    ['CN', 'CN'],
    ['HK', 'HK'],
    ['JP', 'JP'],
    ['KR', 'KR'],
  ] as const)(
    'creates a natural-language project with the %s API market',
    async (market, apiMarket) => {
      const stub = createRequestStub();
      const repository = createApiResearchRepository({ request: stub.request });

      await repository.createResearch({
        query: '  AI compute opportunities  ',
        selectedMarket: market,
      });

      expect(stub.requests[0]).toMatchObject({
        method: 'POST',
        url: RESEARCH_API_PATHS.create,
        data: { query: 'AI compute opportunities', market: apiMarket },
      });
    },
  );

  it('maps an explicitly selected stock to the documented company create fields', async () => {
    const stub = createRequestStub();
    const repository = createApiResearchRepository({ request: stub.request });

    await repository.createResearch({
      query: 'NVDA',
      selectedMarket: 'US',
      selectedStock: {
        stockId: 'us:NVDA',
        companyName: 'NVIDIA Corporation',
        symbol: 'NVDA',
        market: 'US',
        exchange: 'XNAS',
      },
    });
    expect(stub.requests[0]).toMatchObject({
      data: {
        query: 'NVDA',
        market: 'US',
        objectType: 'COMPANY',
        normalizedName: 'NVIDIA Corporation',
      },
    });
  });

  it('confirms a server-provided preflight resolution before research starts', async () => {
    const stub = createRequestStub({
      project: { ...projectDto, status: 'RUNNING' },
    });
    const repository = createApiResearchRepository({ request: stub.request });

    await repository.confirmResearchResolution({
      projectId,
      resolution: 'switch_market',
      market: 'HK',
    });

    expect(stub.requests[0]).toMatchObject({
      method: 'POST',
      url: RESEARCH_API_PATHS.confirm(projectId),
      data: { resolution: 'switch_market', market: 'HK' },
    });
  });

  it('uses the confirmed relative paths and maps snapshot/retry/report contracts', async () => {
    const stub = createRequestStub();
    const repository = createApiResearchRepository({ request: stub.request });

    const snapshot = await repository.getProjectSnapshot(projectId);
    expect(stub.requests[0]).toMatchObject({
      method: 'GET',
      url: RESEARCH_API_PATHS.project(projectId),
    });
    expect(snapshot.project.projectId).toBe(projectId);
    expect(snapshot.progress.agentTasks[0].canRetry).toBe(true);

    const report = await repository.getAgentReport(projectId, agentId);
    expect(report.reportReady).toBe(true);
    expect(report.reportStatus).toBe('available');

    const retried = await repository.retryAgent(projectId, 'industry_research');
    expect(retried.project.projectId).toBe(projectId);
    expect(stub.requests.at(-1)).toMatchObject({
      method: 'POST',
      url: RESEARCH_API_PATHS.retry(projectId),
      data: { agentNames: ['industry_research'] },
    });
  });

  it('loads finalist detail by rank and maps the company model', async () => {
    const repository = createApiResearchRepository({ request: createRequestStub().request });
    await expect(repository.getCompany(projectId, '1')).resolves.toMatchObject({
      projectId,
      companyId: '1',
      ticker: 'NVDA',
      market: 'US',
      strengths: ['Technology moat'],
      risks: ['Valuation risk'],
      qualityScore: 92.5,
    });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
  ] as const)('normalizes project HTTP %s into %s', async (status, code) => {
    const repository = createApiResearchRepository({
      request: async () => {
        throw apiError(status);
      },
    });

    await expect(repository.getProjectSnapshot(projectId)).rejects.toMatchObject({ code, status });
  });

  it.each([400, 409] as const)('normalizes retry HTTP %s as retry-not-allowed', async (status) => {
    const stub = createRequestStub({ retryError: apiError(status) });
    const repository = createApiResearchRepository({ request: stub.request });

    await expect(repository.retryAgent(projectId, 'industry_research')).rejects.toMatchObject({
      code: 'retry-not-allowed',
      status,
    });
  });

  it('uses the owner-only Agent result endpoint as the report source', async () => {
    const repository = createApiResearchRepository({ request: createRequestStub().request });
    await expect(repository.getAgentReport(projectId, agentId)).resolves.toMatchObject({
      reportReady: true,
      reportStatus: 'available',
      rawReport: '# Full report',
      blocks: [{ contentType: 'MARKDOWN' }],
      dataSources: '["annual report"]',
      confidence: 0.92,
    });
  });

  it('parses SSE blocks incrementally and keeps an incomplete buffer', () => {
    const blocks: Array<{ eventName: string; data: string }> = [];
    const remainder = parseSseTextChunk(
      'event: agent_progress\ndata: {"seq": 2}\n\n event: done\ndata: {"seq": -1}',
      (block) => blocks.push(block),
    );

    expect(blocks).toEqual([{ eventName: 'agent_progress', data: '{"seq": 2}' }]);
    expect(remainder).toContain('event: done');
  });

  it('consumes authenticated SSE events and delegates cache decisions to the query layer', async () => {
    const eventTypes: string[] = [];
    let invalidated = 0;
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      fetchCalls.push({ input, init });
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `event: project_status\ndata: ${JSON.stringify({
                seq: 4,
                projectId,
                status: 'RUNNING',
                progress: 42,
              })}\n\n` +
                `event: agent_completed\ndata: ${JSON.stringify({
                  seq: 5,
                  projectId,
                  agentRunId: agentId,
                  agentName: 'industry_research',
                  progress: 100,
                })}\n\n` +
                `event: workflow_completed\ndata: ${JSON.stringify({
                  seq: 6,
                  projectId,
                })}\n\n` +
                `event: heartbeat\ndata: {"seq":0}\n\n` +
                `event: done\ndata: ${JSON.stringify({ seq: -1, projectId })}\n\n`,
            ),
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200 });
    };
    const repository = createApiResearchRepository({
      request: createRequestStub().request,
      fetch,
      apiBaseUrl: '/api',
    });

    const subscription = repository.subscribeProjectEvents(projectId, 0, {
      onEvent: (event) => eventTypes.push(event.type),
      onSnapshotInvalidated: () => {
        invalidated += 1;
      },
    });
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
    subscription.unsubscribe();

    expect(eventTypes).toEqual([
      'project_status',
      'agent_completed',
      'workflow_completed',
      'heartbeat',
      'done',
    ]);
    expect(invalidated).toBe(0);
    expect(fetchCalls[0]?.input).toBe(
      `/api${RESEARCH_API_PATHS.events(projectId, 0, getDeviceId())}`,
    );
    expect(fetchCalls[0]?.init?.headers).toMatchObject({
      Accept: 'text/event-stream',
      'Accept-Language': expect.stringMatching(/^(zh-CN|en-US)$/),
    });
  });

  it('reconnects from the latest project cursor and excludes heartbeat/done sequence values', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const createResponse = (body: string) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body));
          controller.close();
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    };
    const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      fetchCalls.push({ input, init });
      if (fetchCalls.length === 1) {
        return createResponse(
          `event: project_status\ndata: ${JSON.stringify({
            seq: 4,
            projectId,
            status: 'RUNNING',
          })}\n\n`,
        );
      }
      return createResponse(`event: done\ndata: ${JSON.stringify({ seq: -1 })}\n\n`);
    };
    const repository = createApiResearchRepository({
      request: createRequestStub().request,
      fetch,
      reconnectDelayMs: 0,
      apiBaseUrl: '/api',
    });

    const subscription = repository.subscribeProjectEvents(projectId, 0, {});
    await vi.waitFor(() => expect(fetchCalls).toHaveLength(2));
    subscription.unsubscribe();

    expect(fetchCalls[1]?.input).toBe(
      `/api${RESEARCH_API_PATHS.events(projectId, 4, getDeviceId())}`,
    );
  });

  it('aborts a pending stream and does not reconnect or report cancellation as an error', async () => {
    let signal: AbortSignal | undefined;
    const onError = vi.fn();
    const fetch = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        signal = init?.signal ?? undefined;
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      });
    const repository = createApiResearchRepository({
      request: createRequestStub().request,
      fetch,
      reconnectDelayMs: 0,
    });

    const subscription = repository.subscribeProjectEvents(projectId, 0, { onError });
    await vi.waitFor(() => expect(signal).toBeDefined());
    subscription.unsubscribe();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();
  });
});
