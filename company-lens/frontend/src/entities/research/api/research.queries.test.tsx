import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOCK_RESEARCH_SCENARIOS } from '../testing/research-fixtures';
import type { ResearchEventHandlers, ResearchProjectSnapshot } from '../model/research.types';
import type { ResearchRepository } from './research.repository';
import { setResearchRepositoryForTest, resetResearchComposition } from './research.composition';
import {
  applyResearchEventToSnapshot,
  reconcileResearchSnapshot,
  useResearchAgentReport,
  useResearchProgress,
  useResearchProject,
  useResearchProjectEvents,
  useConfirmResearchResolution,
  useCreateResearchProject,
  useSearchStockCandidates,
  researchQueryKeys,
} from './research.queries';

describe('research query contract', () => {
  afterEach(() => {
    resetResearchComposition();
  });

  it('uses one snapshot key and one repository request for project/progress projections', async () => {
    const snapshot = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot;
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn().mockResolvedValue([]),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi.fn().mockResolvedValue(snapshot),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const project = renderHook(() => useResearchProject(snapshot.project.projectId), { wrapper });
    const progress = renderHook(() => useResearchProgress(snapshot.project.projectId), { wrapper });

    await waitFor(() =>
      expect(project.result.current.data?.projectId).toBe(snapshot.project.projectId),
    );
    await waitFor(() =>
      expect(progress.result.current.data?.projectId).toBe(snapshot.project.projectId),
    );
    expect(repository.getProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(researchQueryKeys.project(snapshot.project.projectId)).toEqual(
      researchQueryKeys.progress(snapshot.project.projectId),
    );
    expect(researchQueryKeys.progress(snapshot.project.projectId)).toEqual(
      researchQueryKeys.result(snapshot.project.projectId),
    );
  });

  it('disables resource queries when required identifiers are absent', () => {
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn(),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi.fn(),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const report = renderHook(() => useResearchAgentReport(undefined, 'agent-1'), { wrapper });
    expect(report.result.current.fetchStatus).toBe('idle');
    expect(repository.getAgentReport).not.toHaveBeenCalled();
  });

  it('uses only the normalized query in the candidate key and repository call', async () => {
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn().mockResolvedValue([
        {
          stockId: 'stock-1',
          companyName: 'NVIDIA Corporation',
          symbol: 'NVDA',
          market: 'US',
          exchange: 'NASDAQ',
        },
      ]),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi.fn(),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const candidates = renderHook(() => useSearchStockCandidates('  NVDA  '), { wrapper });

    await waitFor(() => expect(candidates.result.current.data).toHaveLength(1));
    expect(repository.searchStockCandidates).toHaveBeenCalledWith('NVDA');
    expect(queryClient.getQueryData(researchQueryKeys.stockCandidates('NVDA'))).toEqual([
      expect.objectContaining({ stockId: 'stock-1' }),
    ]);
  });

  it('passes selectedStock through the public create mutation without changing command semantics', async () => {
    const project = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot.project;
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn(),
      createResearch: vi.fn().mockResolvedValue(project),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi.fn(),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const mutation = renderHook(() => useCreateResearchProject(), { wrapper });
    const selectedStock = {
      stockId: 'stock-1',
      companyName: 'NVIDIA Corporation',
      symbol: 'NVDA',
      market: 'US' as const,
      exchange: 'NASDAQ',
    };

    await mutation.result.current.mutateAsync({
      query: 'NVDA',
      selectedMarket: 'US',
      selectedStock,
    });

    expect(repository.createResearch).toHaveBeenCalledWith({
      query: 'NVDA',
      selectedMarket: 'US',
      selectedStock,
    });
  });

  it('passes a preflight choice through the confirm mutation', async () => {
    const project = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot.project;
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn(),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn().mockResolvedValue({ ...project, status: 'running' }),
      getProjectSnapshot: vi.fn(),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const mutation = renderHook(() => useConfirmResearchResolution(), { wrapper });

    await mutation.result.current.mutateAsync({
      projectId: project.projectId,
      resolution: 'switch_market',
      market: 'HK',
    });

    expect(repository.confirmResearchResolution).toHaveBeenCalledWith({
      projectId: project.projectId,
      resolution: 'switch_market',
      market: 'HK',
    });
  });

  it('applies server events without deriving a result or mutating unrelated agents', () => {
    const snapshot = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot;
    const next = applyResearchEventToSnapshot(snapshot, {
      type: 'agent_progress',
      projectId: snapshot.project.projectId,
      agentId: snapshot.progress.agentTasks[0].agentId,
      agentType: snapshot.progress.agentTasks[0].agentType,
      progressPercent: 77,
      seq: 1,
    });

    expect(next.progress.agentTasks[0].progressPercent).toBe(77);
    expect(next.progress.agentTasks[1]).toEqual(snapshot.progress.agentTasks[1]);
    expect(next.result).toEqual(snapshot.result);
  });

  it('reconciles stale non-terminal Agent rows in a successful terminal snapshot', () => {
    const source = MOCK_RESEARCH_SCENARIOS[0].timeline.at(-1)?.snapshot;
    if (!source) {
      throw new Error('Completed research fixture is missing.');
    }
    const staleSnapshot = {
      ...source,
      progress: {
        ...source.progress,
        agentTasks: source.progress.agentTasks.map((agent) => ({
          ...agent,
          status: 'running' as const,
          progressPercent: 90,
          reportReady: false,
        })),
      },
    };

    const reconciled = reconcileResearchSnapshot(staleSnapshot);

    expect(reconciled.progress.agentTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'completed', progressPercent: 100, reportReady: true }),
      ]),
    );
    expect(reconciled.contractIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'snapshot-inconsistent',
          details: expect.objectContaining({ reason: 'terminal-agent-stale' }),
        }),
      ]),
    );
  });

  it('does not let replayed events regress terminal Agent state or progress', () => {
    const source = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot;
    const completedAgent = {
      ...source.progress.agentTasks[0],
      status: 'completed' as const,
      progressPercent: 100,
      reportReady: true,
    };
    const runningAgent = {
      ...source.progress.agentTasks[1],
      status: 'running' as const,
      progressPercent: 80,
    };
    const snapshot = {
      ...source,
      project: { ...source.project, status: 'running' as const },
      progress: {
        ...source.progress,
        status: 'running' as const,
        agentTasks: [completedAgent, runningAgent, ...source.progress.agentTasks.slice(2)],
      },
    };
    const afterStatusReplay = applyResearchEventToSnapshot(snapshot, {
      type: 'agent_status',
      projectId: snapshot.project.projectId,
      agentId: completedAgent.agentId,
      agentType: completedAgent.agentType,
      status: 'running',
      progressPercent: 90,
      seq: 1,
    });
    const afterProgressReplay = applyResearchEventToSnapshot(afterStatusReplay, {
      type: 'agent_progress',
      projectId: snapshot.project.projectId,
      agentId: runningAgent.agentId,
      agentType: runningAgent.agentType,
      progressPercent: 20,
      seq: 2,
    });

    expect(afterProgressReplay.progress.agentTasks[0]).toMatchObject({
      status: 'completed',
      progressPercent: 100,
    });
    expect(afterProgressReplay.progress.agentTasks[1]).toMatchObject({
      status: 'running',
      progressPercent: 80,
    });
  });

  it('coalesces workflow completion and done into one final snapshot refresh', async () => {
    const source = MOCK_RESEARCH_SCENARIOS[0];
    const runningSnapshot = source.timeline[0].snapshot;
    const completedSnapshot = source.timeline.at(-1)?.snapshot;
    if (!completedSnapshot) {
      throw new Error('Completed research fixture is missing.');
    }
    let handlers: ResearchEventHandlers | undefined;
    let resolveFinalSnapshot!: (snapshot: ResearchProjectSnapshot) => void;
    const finalSnapshot = new Promise<ResearchProjectSnapshot>((resolve) => {
      resolveFinalSnapshot = resolve;
    });
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn(),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi
        .fn()
        .mockResolvedValueOnce(runningSnapshot)
        .mockReturnValueOnce(finalSnapshot),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn((_projectId, _afterSeq, nextHandlers) => {
        handlers = nextHandlers;
        return { unsubscribe: vi.fn() };
      }),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const progress = renderHook(
      () => {
        const query = useResearchProgress(runningSnapshot.project.projectId);
        useResearchProjectEvents(runningSnapshot.project.projectId);
        return query;
      },
      { wrapper },
    );
    await waitFor(() => expect(progress.result.current.data?.status).toBe('running'));
    if (!handlers) {
      throw new Error('Research event handlers were not registered.');
    }

    act(() => {
      handlers?.onEvent?.({
        type: 'workflow_completed',
        projectId: runningSnapshot.project.projectId,
        seq: 9,
      });
      handlers?.onEvent?.({
        type: 'done',
        projectId: runningSnapshot.project.projectId,
        seq: -1,
      });
    });
    await waitFor(() => expect(repository.getProjectSnapshot).toHaveBeenCalledTimes(2));

    resolveFinalSnapshot(completedSnapshot);
    await waitFor(() => expect(progress.result.current.data?.status).toBe('completed'));
    expect(repository.getProjectSnapshot).toHaveBeenCalledTimes(2);
  });

  it('keeps realtime report messages when the report query was not mounted yet', async () => {
    const snapshot = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot;
    const agent = snapshot.progress.agentTasks[0];
    const report = MOCK_RESEARCH_SCENARIOS[0].reports[agent.agentId];
    const message = {
      messageId: 'realtime-report-message',
      conversationId: 'conversation-1',
      projectId: snapshot.project.projectId,
      agentRunId: agent.agentId,
      role: 'ASSISTANT' as const,
      content: '实时补充报告',
      contentType: 'MARKDOWN' as const,
      stage: 'REPORT' as const,
      messageSequence: 7,
    };
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn(),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi.fn().mockResolvedValue(snapshot),
      getAgentReport: vi.fn().mockResolvedValue({
        ...report,
        reportStatus: 'unavailable',
        reportReady: false,
        blocks: undefined,
        rawReport: undefined,
      }),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn((_projectId, _afterSeq, handlers) => {
        handlers.onEvent?.({
          type: 'message',
          projectId: snapshot.project.projectId,
          message,
        });
        return { unsubscribe: vi.fn() };
      }),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useResearchProjectEvents(snapshot.project.projectId), { wrapper });
    const reportQuery = renderHook(
      () => useResearchAgentReport(snapshot.project.projectId, agent.agentId),
      { wrapper },
    );

    await waitFor(() => expect(reportQuery.result.current.data?.reportReady).toBe(true));
    expect(reportQuery.result.current.data?.rawReport).toContain('实时补充报告');
    expect(reportQuery.result.current.data?.blocks?.[0]?.messageIds).toContain(
      'realtime-report-message',
    );
  });
});
