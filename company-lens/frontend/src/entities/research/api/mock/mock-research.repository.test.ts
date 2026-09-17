import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResearchError } from '../../model/research.errors';
import { MOCK_RESEARCH_SCENARIOS } from '../../testing/research-fixtures';
import { MockResearchScheduler } from './mock-research.scheduler';
import { createMockResearchRepository } from './mock-research.repository';

describe('mock research repository', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches US and HK candidates by query without selecting one implicitly', async () => {
    const repository = createMockResearchRepository({ requestDelayMs: 0 });

    await expect(repository.searchStockCandidates('NVDA')).resolves.toEqual([
      expect.objectContaining({ symbol: 'NVDA', market: 'US' }),
    ]);
    await expect(repository.searchStockCandidates('腾讯')).resolves.toEqual([
      expect.objectContaining({ symbol: '0700.HK', market: 'HK' }),
    ]);
    await expect(repository.searchStockCandidates('no-such-company')).resolves.toEqual([]);
    await expect(repository.searchStockCandidates('search-error')).rejects.toMatchObject({
      code: 'request-failed',
    });
  });

  it('persists successful created projects and keeps create failures typed', async () => {
    const repository = createMockResearchRepository({ requestDelayMs: 0 });
    const project = await repository.createResearch({
      query: 'AI compute',
      selectedMarket: 'US',
      selectedStock: {
        stockId: 'mock-stock-nvda',
        companyName: 'NVIDIA Corporation',
        symbol: 'NVDA',
        market: 'US',
        exchange: 'NASDAQ',
      },
    });

    await expect(repository.getProjectSnapshot(project.projectId)).resolves.toMatchObject({
      project: { projectId: project.projectId, objectType: 'company', market: 'US' },
      progress: { projectId: project.projectId },
    });
    await expect(
      repository.createResearch({ query: 'create-error', selectedMarket: 'CN' }),
    ).rejects.toMatchObject({ code: 'request-failed' });
  });

  it('moves a created project from waiting to completed one Agent at a time', async () => {
    vi.useFakeTimers();
    const repository = createMockResearchRepository({ requestDelayMs: 0 });
    const project = await repository.createResearch({
      query: 'AI compute timeline',
      selectedMarket: 'US',
    });
    const events: string[] = [];
    const subscription = repository.subscribeProjectEvents(project.projectId, 0, {
      onEvent: (event) => events.push(event.type),
    });

    await expect(repository.getProjectSnapshot(project.projectId)).resolves.toMatchObject({
      project: { status: 'waiting' },
      progress: {
        status: 'waiting',
        progressPercent: 0,
        agentTasks: [
          { status: 'waiting' },
          { status: 'waiting' },
          { status: 'waiting' },
          { status: 'waiting' },
          { status: 'waiting' },
        ],
      },
    });

    vi.advanceTimersByTime(900);
    await expect(repository.getProjectSnapshot(project.projectId)).resolves.toMatchObject({
      progress: {
        status: 'running',
        agentTasks: expect.arrayContaining([
          expect.objectContaining({ status: 'running', displayOrder: 1 }),
          expect.objectContaining({ status: 'waiting', displayOrder: 2 }),
        ]),
      },
    });

    vi.advanceTimersByTime(5 * 900);
    await expect(repository.getProjectSnapshot(project.projectId)).resolves.toMatchObject({
      project: { status: 'completed' },
      progress: {
        status: 'completed',
        progressPercent: 100,
        resultReady: true,
        agentTasks: [
          { status: 'completed', reportReady: true },
          { status: 'completed', reportReady: true },
          { status: 'completed', reportReady: true },
          { status: 'completed', reportReady: true },
          { status: 'completed', reportReady: true },
        ],
      },
    });
    expect(events).toContain('project_status');

    const completedSnapshot = await repository.getProjectSnapshot(project.projectId);
    const industryAgent = completedSnapshot.progress.agentTasks[0];
    const industryReport = await repository.getAgentReport(
      project.projectId,
      industryAgent.agentId,
    );
    expect(industryReport.blocks?.[0]).toMatchObject({
      stage: 'REPORT',
      contentType: 'MARKDOWN',
    });
    expect(industryReport.blocks?.[0]?.content).toContain('## 核心结论');
    expect(industryReport.blocks?.[0]?.content).toContain('| 观察维度 | 当前判断 | 后续跟踪 |');
    subscription.unsubscribe();
  });

  it('keeps snapshot, report and company reads behind one repository contract', async () => {
    const scenario = MOCK_RESEARCH_SCENARIOS[2];
    const repository = createMockResearchRepository({ requestDelayMs: 0, scenarios: [scenario] });
    const snapshot = await repository.getProjectSnapshot(scenario.projectId);
    const companyId = snapshot.result.finalists?.[0]?.companyId;

    expect(snapshot.project.projectId).toBe(scenario.projectId);
    expect(snapshot.result.confidence).toBeUndefined();
    expect(snapshot.result.qualityScore).toBeUndefined();
    expect(companyId).toBeDefined();

    const report = await repository.getAgentReport(
      scenario.projectId,
      snapshot.progress.agentTasks[0].agentId,
    );
    expect(report.reportReady).toBe(true);
    await expect(repository.getCompany(scenario.projectId, companyId ?? '')).resolves.toMatchObject(
      {
        projectId: scenario.projectId,
      },
    );
  });

  it('persists state and emits events independently of a page subscription', async () => {
    vi.useFakeTimers();
    const scenario = MOCK_RESEARCH_SCENARIOS[0];
    const scheduler = new MockResearchScheduler([scenario]);
    const repository = createMockResearchRepository({
      scenarios: [scenario],
      scheduler,
      requestDelayMs: 0,
    });
    const events: string[] = [];
    let invalidated = 0;
    const subscription = repository.subscribeProjectEvents(scenario.projectId, 0, {
      onEvent: (event) => events.push(event.type),
      onSnapshotInvalidated: () => {
        invalidated += 1;
      },
    });

    vi.advanceTimersByTime(2400);
    subscription.unsubscribe();
    expect(events).toContain('project_status');
    expect(invalidated).toBeGreaterThan(0);
    await expect(repository.getProjectSnapshot(scenario.projectId)).resolves.toMatchObject({
      result: { resultCompleteness: 'full' },
    });
    scheduler.destroy();
  });

  it('returns typed errors for missing resources and disallowed retry', async () => {
    const scenario = MOCK_RESEARCH_SCENARIOS[2];
    const repository = createMockResearchRepository({ requestDelayMs: 0, scenarios: [scenario] });

    await expect(repository.getProjectSnapshot('missing-project')).rejects.toMatchObject({
      code: 'not-found',
    });
    await expect(
      repository.retryAgent(scenario.projectId, 'industry_research'),
    ).rejects.toMatchObject({
      code: 'retry-not-allowed',
    });
  });

  it('can inject a typed request failure without changing the domain contract', async () => {
    const scenario = MOCK_RESEARCH_SCENARIOS[0];
    const repository = createMockResearchRepository({
      scenarios: [scenario],
      requestDelayMs: 0,
      failure: (operation, projectId) =>
        operation === 'snapshot'
          ? new ResearchError('request-failed', `fixture request failed for ${projectId}`)
          : undefined,
    });

    await expect(repository.getProjectSnapshot(scenario.projectId)).rejects.toThrow(
      'fixture request failed',
    );
  });
});
