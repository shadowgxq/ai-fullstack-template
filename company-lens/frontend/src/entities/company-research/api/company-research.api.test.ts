import { describe, expect, it, vi } from 'vitest';

import {
  createCompanyResearchApi,
  parseCompanyResearchSseChunk,
  toRetryCapabilityName,
} from './company-research.api';

describe('company research api', () => {
  it('uses the new task paths and retry capability contract', async () => {
    const request = vi.fn().mockResolvedValue('');
    const repository = createCompanyResearchApi({ request });

    await repository.retryCapability('1874001493837324289', 'investment_team_agent');

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/v1/research/tasks/1874001493837324289/retry',
      data: { capability: 'investment_team' },
    });
    expect(toRetryCapabilityName('management_deep_dive_agent')).toBe('management_deep_dive');
  });

  it('posts the final report retry without a request body', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const repository = createCompanyResearchApi({ request });

    await repository.retryReport('task/report-1');

    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/v1/research/tasks/task%2Freport-1/retry-report',
    });
  });

  it.each([
    ['REPORT_NOT_RETRYABLE', 422, 'report-retry-not-allowed'],
    ['REPORT_RETRY_CONFLICT', 409, 'report-retry-conflict'],
    ['REPORT_RETRY_FAILED', 502, 'report-retry-failed'],
  ] as const)('maps %s to the report retry error %s', async (errorCode, status, code) => {
    const request = vi.fn().mockRejectedValue({
      __apiError: true,
      message: 'server message',
      status,
      errorCode,
    });
    const repository = createCompanyResearchApi({ request });

    await expect(repository.retryReport('task-1')).rejects.toMatchObject({ code, errorCode });
  });

  it('parses Task and Report responses returned by product-server', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ taskId: 'task-1', query: 'NVIDIA', status: 'COMPLETED' })
      .mockResolvedValueOnce({
        report: { directAnswer: { reason: 'A direct answer' } },
        reportMarkdown: '# Research report',
      });
    const repository = createCompanyResearchApi({ request });

    await expect(repository.getTask('task-1')).resolves.toMatchObject({
      taskId: 'task-1',
      status: 'completed',
    });
    await expect(repository.getReport('task-1')).resolves.toEqual({
      report: { directAnswer: { reason: 'A direct answer' } },
      reportMarkdown: '# Research report',
    });
  });

  it('passes includeMessages when loading a lightweight task snapshot', async () => {
    const request = vi.fn().mockResolvedValue({
      taskId: 'task-1',
      query: 'NVIDIA',
      status: 'SUCCEEDED',
      capabilities: [],
    });
    const repository = createCompanyResearchApi({ request });

    await repository.getTask('task-1', { includeMessages: false });

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/v1/research/tasks/task-1',
      params: { includeMessages: false },
    });
  });

  it('maps creation, history, deletion, and binding requests', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ taskId: 'task-1', query: 'Apple', status: 'PENDING' })
      .mockResolvedValueOnce({ items: [], page: 2, size: 10, total: 0 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ code: 200, data: { taskId: 'task-1', userId: 1 } });
    const repository = createCompanyResearchApi({ request });

    await repository.createTask({
      recognitionId: 'rec-1',
      candidateId: 'candidate-1',
      query: 'Apple',
      conversationId: 'conversation-1',
      language: 'en-US',
    });
    await repository.listHistory({ keyword: 'apple', page: 2, size: 10 });
    await repository.deleteHistory('task-1');
    await expect(repository.bindTask('task-1')).resolves.toBeUndefined();

    expect(request).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/v1/research/tasks',
      data: {
        recognitionId: 'rec-1',
        candidateId: 'candidate-1',
        query: 'Apple',
        conversationId: 'conversation-1',
        language: 'en-US',
      },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      url: '/v1/research/history',
      params: { keyword: 'apple', page: 2, size: 10 },
    });
    expect(request).toHaveBeenNthCalledWith(3, {
      method: 'DELETE',
      url: '/v1/research/history/task-1',
    });
    expect(request).toHaveBeenNthCalledWith(4, {
      method: 'POST',
      url: '/v1/research/tasks/task-1/bind',
    });
  });

  it('opens the recognition SSE with the encoded query and maps recognition events', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'event: recognition_started\ndata: {"conversationId":"conversation-1","query":"Apple & AI","seq":1}\n\n' +
                'event: recognition_result\ndata: {"conversation_id":"conversation-1","recognition_id":"rec-1","status":"AMBIGUOUS","candidates":[{"candidate_id":"candidate-1","object_name":"Apple Inc.","is_researchable":true}],"seq":2}\n\n' +
                'event: task_complete\ndata: {"taskId":"task-1","seq":3}\n\n',
            ),
          );
        },
      }),
    } as Response);
    const onEvent = vi.fn();
    const repository = createCompanyResearchApi({ fetch });

    repository.subscribeRecognition('Apple & AI', { onEvent }, 'en-US');

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(3));
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/research/recognitions?query=Apple%20%26%20AI&language=en-US',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          'Accept-Language': expect.stringMatching(/^(zh-CN|en-US)$/),
          'X-Device-Id': expect.any(String),
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(onEvent.mock.calls[1]?.[0]).toMatchObject({
      type: 'recognition_result',
      conversationId: 'conversation-1',
      recognitionId: 'rec-1',
      recognition: {
        recognitionId: 'rec-1',
        status: 'ambiguous',
        conversationId: 'conversation-1',
        candidates: [{ candidateId: 'candidate-1', objectName: 'Apple Inc.', canResearch: true }],
      },
    });
    expect(onEvent.mock.calls[2]?.[0]).toMatchObject({
      type: 'task_complete',
      taskId: 'task-1',
      isTerminal: true,
    });
  });

  it('does not retry recognition when the SSE ends before a terminal event', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'event: recognition_started\ndata: {"conversationId":"conversation-1","query":"NVDA"}\n\n',
            ),
          );
          controller.close();
        },
      }),
    } as Response);
    const onError = vi.fn();
    const repository = createCompanyResearchApi({ fetch, reconnectDelayMs: 0 });

    repository.subscribeRecognition('NVDA', { onEvent: vi.fn(), onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      message: 'Recognition SSE ended before completion.',
    });
  });

  it('loads an independent capability report', async () => {
    const request = vi.fn().mockResolvedValue({
      code: 200,
      data: {
        agentName: 'investment_team',
        reportReady: true,
        reportMarkdown: '# Team report',
        normalizedOutput: '{"decision":"HOLD"}',
        sources: '[{"title":"Annual report"}]',
      },
    });
    const repository = createCompanyResearchApi({ request });

    await expect(repository.getCapabilityResult('task-1', 'investment_team')).resolves.toEqual({
      agentName: 'investment_team',
      reportReady: true,
      reportMarkdown: '# Team report',
      normalizedOutput: { decision: 'HOLD' },
      sources: [{ title: 'Annual report' }],
    });
    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/v1/research/tasks/task-1/capabilities/investment_team',
    });
  });

  it('parses SSE blocks incrementally including a cursor id', () => {
    const blocks: unknown[] = [];
    let buffer = parseCompanyResearchSseChunk(
      'id: 7\nevent: status_change\ndata: {"taskId":"task-1"}\n\nevent: agent_progress\ndata:',
      (block) => blocks.push(block),
    );
    buffer = parseCompanyResearchSseChunk(
      `${buffer} {"agentRunId":"agent-1","progress":45}\n\n`,
      (block) => blocks.push(block),
    );

    expect(blocks).toEqual([
      { id: '7', eventName: 'status_change', data: '{"taskId":"task-1"}' },
      {
        eventName: 'agent_progress',
        data: '{"agentRunId":"agent-1","progress":45}',
      },
    ]);
    expect(buffer).toBe('');
  });

  it('parses agent_progress details while preserving the task snapshot flow', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'event: agent_progress\ndata: {"seq":3,"agentRunId":9001,"agentName":"investment_research","displayName":"Investment research","progress":"45","summary":"Reviewed filings","title":"Sources","eventType":"subagent_progress","skillName":"investment-team","visibility":"user_safe","sourceRefs":["https://example.com"]}\n\n',
            ),
          );
        },
      }),
    } as Response);
    const onEvent = vi.fn();
    const repository = createCompanyResearchApi({ fetch, reconnectDelayMs: 0 });

    const subscription = repository.subscribeEvents('task-1', { onEvent });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent).toHaveBeenCalledWith({
      type: 'agent_progress',
      seq: 3,
      isTerminal: false,
      agentRunId: '9001',
      agentName: 'investment_research',
      displayName: 'Investment research',
      progress: 45,
      summary: 'Reviewed filings',
      title: 'Sources',
      eventType: 'subagent_progress',
      skillName: 'investment-team',
      visibility: 'user_safe',
      sourceRefs: ['https://example.com'],
    });
    subscription.close();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('starts task SSE from the supplied last sequence', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('event: task_complete\ndata: {"taskId":"task-1","seq":8}\n\n'),
          );
        },
      }),
    } as Response);
    const repository = createCompanyResearchApi({ fetch });

    repository.subscribeEvents('task-1', { onEvent: vi.fn() }, 7);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/research/tasks/task-1/events?afterSeq=7',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('treats the server done event as terminal and falls back to projectId', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'event: done\ndata: {"seq":-1,"projectId":"task-1","type":"DONE"}\n\n',
            ),
          );
          controller.close();
        },
      }),
    } as Response);
    const onEvent = vi.fn();
    const repository = createCompanyResearchApi({ fetch, reconnectDelayMs: 0 });

    repository.subscribeEvents('task-1', { onEvent });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent).toHaveBeenCalledWith({
      type: 'done',
      taskId: 'task-1',
      seq: -1,
      isTerminal: true,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses DONE from the payload when the SSE event name is omitted', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"seq":-1,"projectId":"task-1","type":"DONE","message":"Unable to recognize"}\n\n',
            ),
          );
          controller.close();
        },
      }),
    } as Response);
    const onEvent = vi.fn();
    const repository = createCompanyResearchApi({ fetch, reconnectDelayMs: 0 });

    repository.subscribeRecognition('Unknown target', { onEvent });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent).toHaveBeenCalledWith({
      type: 'done',
      taskId: 'task-1',
      seq: -1,
      message: 'Unable to recognize',
      isTerminal: true,
    });
  });

  it('maps capability_status events that use the server name field', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'event: capability_status\ndata: {"taskId":"task-1","name":"investment_team","status":"SUCCEEDED","seq":4}\n\n',
            ),
          );
        },
      }),
    } as Response);
    const onEvent = vi.fn();
    const repository = createCompanyResearchApi({ fetch });
    const subscription = repository.subscribeEvents('task-1', { onEvent });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'capability_status',
        taskId: 'task-1',
        agentName: 'investment_team',
        status: 'SUCCEEDED',
      }),
    );
    subscription.close();
  });
});
