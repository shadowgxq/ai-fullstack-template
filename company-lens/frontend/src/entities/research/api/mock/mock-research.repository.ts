import { ResearchError } from '../../model/research.errors';
import type {
  AgentReport,
  ConfirmResearchResolutionCommand,
  CreateResearchCommand,
  ResearchCompany,
  ResearchEvent,
  ResearchEventHandlers,
  ResearchProjectSnapshot,
  ResearchProject,
  ResearchEventSubscription,
  StockCandidate,
  ResearchAgentStatus,
} from '../../model/research.types';
import { RESEARCH_AGENT_TYPES } from '../../model/research.constants';
import { MOCK_RESEARCH_SCENARIOS } from '../../testing/research-fixtures';
import {
  MockResearchScheduler,
  type MockResearchSchedulerOptions,
} from './mock-research.scheduler';
import { createIndustryResearchMarkdown } from './mock-research.content';
import type { MockResearchScenario } from './mock-research.types';
import type { ResearchRepository } from '../research.repository';

const DEFAULT_MOCK_REQUEST_DELAY_MS = 180;

type MockOperation =
  | 'list'
  | 'snapshot'
  | 'agent-report'
  | 'company'
  | 'retry'
  | 'candidate-search'
  | 'confirm'
  | 'create';

export type MockResearchRepositoryOptions = MockResearchSchedulerOptions & {
  scenarios?: readonly MockResearchScenario[];
  scheduler?: MockResearchScheduler;
  requestDelayMs?: number;
  failure?: (operation: MockOperation, projectId: string) => ResearchError | undefined;
};

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

const MOCK_STOCK_CANDIDATES: readonly StockCandidate[] = [
  {
    stockId: 'mock-stock-nvda',
    companyName: 'NVIDIA Corporation',
    symbol: 'NVDA',
    market: 'US',
    exchange: 'NASDAQ',
  },
  {
    stockId: 'mock-stock-amd',
    companyName: 'Advanced Micro Devices',
    symbol: 'AMD',
    market: 'US',
    exchange: 'NASDAQ',
  },
  {
    stockId: 'mock-stock-tsm',
    companyName: 'Taiwan Semiconductor Manufacturing',
    symbol: 'TSM',
    market: 'US',
    exchange: 'NYSE',
  },
  {
    stockId: 'mock-stock-tencent',
    companyName: '腾讯控股',
    symbol: '0700.HK',
    market: 'HK',
    exchange: 'HKEX',
  },
];

function createPendingSnapshot(
  command: CreateResearchCommand,
  projectId: string,
): ResearchProjectSnapshot {
  const objectType = command.selectedStock ? 'company' : 'theme';
  const displayName = command.selectedStock?.companyName ?? command.query;
  const agentTasks = RESEARCH_AGENT_TYPES.map((agentType, index) => ({
    agentId: `${projectId}-agent-${index + 1}`,
    agentType,
    displayOrder: index + 1,
    status: 'waiting' as const,
    reportReady: false,
    canRetry: false,
  }));

  return {
    project: {
      projectId,
      query: command.query,
      normalizedName: displayName,
      objectType,
      market: command.selectedMarket,
      status: 'waiting',
      createdAt: '2026-07-21 00:00:00',
      updatedAt: '2026-07-21 00:00:00',
    },
    progress: {
      projectId,
      status: 'waiting',
      resultReady: false,
      resultCompleteness: 'unavailable',
      agentTasks,
      progressMessage: 'The research project is waiting to start.',
    },
    result: {
      projectId,
      researchMode: objectType,
      resultReady: false,
      resultCompleteness: 'unavailable',
    },
  };
}

function createCreatedScenario(
  command: CreateResearchCommand,
  projectId: string,
): MockResearchScenario {
  const pendingSnapshot = createPendingSnapshot(command, projectId);
  const statusSteps: readonly (readonly ResearchAgentStatus[])[] = [
    ['waiting', 'waiting', 'waiting', 'waiting', 'waiting'],
    ['running', 'waiting', 'waiting', 'waiting', 'waiting'],
    ['completed', 'running', 'waiting', 'waiting', 'waiting'],
    ['completed', 'completed', 'running', 'waiting', 'waiting'],
    ['completed', 'completed', 'completed', 'running', 'waiting'],
    ['completed', 'completed', 'completed', 'completed', 'running'],
    ['completed', 'completed', 'completed', 'completed', 'completed'],
  ];
  const progressSteps = [0, 16, 34, 51, 68, 84, 100];
  const timeline = statusSteps.map((statuses, stepIndex) => {
    const isComplete = stepIndex === statusSteps.length - 1;
    const activeAgentIndex = statuses.findIndex((status) => status === 'running');
    const agentTasks = pendingSnapshot.progress.agentTasks.map((agent, agentIndex) => ({
      ...agent,
      status: statuses[agentIndex] ?? 'waiting',
      ...(statuses[agentIndex] === 'running'
        ? { progressPercent: Math.max(8, progressSteps[stepIndex] - agentIndex * 3) }
        : {}),
      ...(statuses[agentIndex] === 'completed'
        ? { progressPercent: 100, summary: 'Mock Agent completed.' }
        : {}),
      reportReady: isComplete,
      canRetry: false,
    }));
    const projectStatus = isComplete ? 'completed' : stepIndex === 0 ? 'waiting' : 'running';
    const snapshot: ResearchProjectSnapshot = {
      ...pendingSnapshot,
      project: { ...pendingSnapshot.project, status: projectStatus },
      progress: {
        ...pendingSnapshot.progress,
        status: projectStatus,
        progressPercent: progressSteps[stepIndex],
        resultReady: isComplete,
        resultCompleteness: isComplete ? 'full' : 'unavailable',
        agentTasks,
        progressMessage: isComplete
          ? 'All research Agents have completed.'
          : activeAgentIndex >= 0
            ? `Mock Agent ${activeAgentIndex + 1} is working.`
            : 'The research project is waiting to start.',
      },
      result: {
        ...pendingSnapshot.result,
        resultReady: isComplete,
        resultCompleteness: isComplete ? 'full' : 'unavailable',
      },
    };
    return { afterMs: stepIndex * 900, snapshot };
  });
  const reports = Object.fromEntries(
    pendingSnapshot.progress.agentTasks.map((agent) => {
      const isIndustryResearch = agent.agentType === 'industry_research';
      const reportContent = isIndustryResearch
        ? createIndustryResearchMarkdown({
            query: pendingSnapshot.project.normalizedName ?? command.query,
            market: command.selectedMarket,
          })
        : `${agent.agentType} 已完成本轮研究，详细结论将在后续 Mock 数据中补充。`;

      return [
        agent.agentId,
        {
          projectId,
          agentId: agent.agentId,
          agentType: agent.agentType,
          status: 'completed' as const,
          reportStatus: 'available' as const,
          reportReady: true,
          summary: isIndustryResearch
            ? `${pendingSnapshot.project.normalizedName ?? command.query}需求仍具韧性，需持续跟踪资本开支、供给约束和商业化兑现。`
            : 'Mock Agent completed.',
          blocks: [
            {
              stage: 'REPORT' as const,
              content: reportContent,
              contentType: 'MARKDOWN' as const,
              messageIds: [`${projectId}-${agent.agentType}-report`],
            },
          ],
          rawReport: reportContent,
          ...(isIndustryResearch
            ? {
                standardizedResult: {
                  key: '行业景气判断',
                  category: 'analysis' as const,
                  value: '中长期需求保持韧性，短期进入业绩验证阶段。',
                  fact: '核心环节的资本开支与交付周期仍是供需变化的领先指标。',
                  analysis: '利润更可能向技术壁垒高、现金流质量好的环节集中。',
                  riskToVerify: '需求放缓或技术路线切换可能导致估值与盈利预期同步下修。',
                },
                sources: [
                  {
                    category: 'source' as const,
                    title: 'Mock 行业公开资料汇总',
                    content: '用于开发环境展示来源结构，不代表真实研究引用。',
                    sourceUrl: 'https://example.com/mock-industry-research',
                  },
                ],
              }
            : {}),
        },
      ];
    }),
  );
  return {
    scenarioId: `created-${projectId}`,
    projectId,
    objectType:
      pendingSnapshot.project.objectType === 'unknown'
        ? 'theme'
        : pendingSnapshot.project.objectType,
    market: command.selectedMarket,
    description: 'Created research project mock timeline.',
    timeline,
    reports,
    coverage: {
      hasLongContent: false,
      hasMissingOptionalFields: false,
      supportsReentry: true,
      hasFailureBlockedState: false,
      hasRetryProgression: false,
    },
  };
}

function copyReport(report: AgentReport, snapshot: ResearchProjectSnapshot): AgentReport {
  const agent = snapshot.progress.agentTasks.find((item) => item.agentId === report.agentId);
  if (!agent) {
    return report;
  }
  const reportReady = report.reportReady && agent.status === 'completed';
  const summary =
    report.summary === 'Mock Agent completed.' && report.standardizedResult?.value
      ? report.standardizedResult.value
      : report.summary;
  return {
    ...report,
    status: agent.status,
    ...(summary !== undefined ? { summary } : {}),
    ...(agent.rawStatus ? { rawStatus: agent.rawStatus } : {}),
    reportReady,
    reportStatus: reportReady ? 'available' : 'unavailable',
    ...(agent.summary ? { summary: agent.summary } : {}),
    ...(agent.errorMessage ? { errorMessage: agent.errorMessage } : {}),
    ...(reportReady ? {} : { blocks: undefined, sources: undefined, rawReport: undefined }),
  };
}

function createEvents(
  previousSnapshot: ResearchProjectSnapshot,
  snapshot: ResearchProjectSnapshot,
  nextSeq: () => number,
): readonly ResearchEvent[] {
  const events: ResearchEvent[] = [];
  const previousAgents = new Map(
    previousSnapshot.progress.agentTasks.map((agent) => [agent.agentId, agent]),
  );

  for (const agent of snapshot.progress.agentTasks) {
    const previous = previousAgents.get(agent.agentId);
    if (!previous) {
      continue;
    }
    if (previous.status !== agent.status || previous.displayName !== agent.displayName) {
      events.push({
        type: 'agent_status',
        projectId: snapshot.project.projectId,
        agentId: agent.agentId,
        agentType: agent.agentType,
        status: agent.status,
        ...(agent.rawStatus ? { rawStatus: agent.rawStatus } : {}),
        ...(agent.progressPercent !== undefined ? { progressPercent: agent.progressPercent } : {}),
        ...(agent.displayName ? { displayName: agent.displayName } : {}),
        seq: nextSeq(),
      });
    } else if (
      previous.progressPercent !== agent.progressPercent &&
      agent.progressPercent !== undefined
    ) {
      events.push({
        type: 'agent_progress',
        projectId: snapshot.project.projectId,
        agentId: agent.agentId,
        agentType: agent.agentType,
        progressPercent: agent.progressPercent ?? 0,
        seq: nextSeq(),
      });
    }
    if (previous.summary !== agent.summary && agent.summary !== undefined) {
      events.push({
        type: 'agent_summary',
        projectId: snapshot.project.projectId,
        agentId: agent.agentId,
        agentType: agent.agentType,
        summary: agent.summary,
        seq: nextSeq(),
      });
    }
  }

  if (
    previousSnapshot.project.status !== snapshot.project.status ||
    previousSnapshot.progress.progressPercent !== snapshot.progress.progressPercent
  ) {
    events.push({
      type: 'project_status',
      projectId: snapshot.project.projectId,
      status: snapshot.project.status,
      ...(snapshot.project.rawStatus ? { rawStatus: snapshot.project.rawStatus } : {}),
      ...(snapshot.progress.progressPercent !== undefined
        ? { progressPercent: snapshot.progress.progressPercent }
        : {}),
      seq: nextSeq(),
    });
  }

  return events;
}

/**
 * Mock repository 把 scenario、scheduler 和请求延迟藏在 adapter 内部。
 * 页面只接触 ResearchRepository，因此离开页面只会取消当前订阅，不会清除项目状态。
 */
export function createMockResearchRepository(
  options: MockResearchRepositoryOptions = {},
): ResearchRepository {
  const scenarios = options.scenarios ?? MOCK_RESEARCH_SCENARIOS;
  const scheduler = options.scheduler ?? new MockResearchScheduler(scenarios, options);
  const requestDelayMs = options.requestDelayMs ?? DEFAULT_MOCK_REQUEST_DELAY_MS;
  const eventSeqByProjectId = new Map<string, number>();
  let createdProjectSeq = 0;

  const failIfConfigured = (operation: MockOperation, projectId: string): void => {
    const configuredError = options.failure?.(operation, projectId);
    if (configuredError) {
      throw configuredError;
    }
  };

  const getScenario = (projectId: string): MockResearchScenario => scheduler.getScenario(projectId);

  const listProjects = async (): Promise<readonly ResearchProject[]> => {
    failIfConfigured('list', 'all');
    await delay(requestDelayMs);
    return scenarios.map((scenario) => scheduler.getSnapshot(scenario.projectId).project);
  };

  const searchStockCandidates = async (query: string): Promise<readonly StockCandidate[]> => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    failIfConfigured('candidate-search', query);
    await delay(requestDelayMs);
    if (query.toLowerCase().includes('search-error')) {
      throw new ResearchError('request-failed', 'Stock candidate search failed in the fixture.');
    }
    return MOCK_STOCK_CANDIDATES.filter((candidate) =>
      [candidate.companyName, candidate.symbol, candidate.exchange].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  };

  const createResearch = async (command: CreateResearchCommand): Promise<ResearchProject> => {
    failIfConfigured('create', command.query);
    await delay(requestDelayMs);
    if (command.query.toLowerCase().includes('create-error')) {
      throw new ResearchError('request-failed', 'Research project creation failed in the fixture.');
    }
    createdProjectSeq += 1;
    const projectId = `mock-created-${createdProjectSeq.toString().padStart(4, '0')}`;
    const snapshot = createPendingSnapshot(command, projectId);
    scheduler.registerScenario(createCreatedScenario(command, projectId));
    return { ...snapshot.project };
  };

  const confirmResearchResolution = async (
    command: ConfirmResearchResolutionCommand,
  ): Promise<ResearchProject> => {
    failIfConfigured('confirm', command.projectId);
    const scenario = getScenario(command.projectId);
    await delay(scenario.requestDelayMs ?? requestDelayMs);
    const project = scheduler.getSnapshot(command.projectId).project;
    return {
      ...project,
      market: command.market,
      status: project.status === 'waiting' ? 'running' : project.status,
      preflightStatus: 'READY',
    };
  };

  const getProjectSnapshot = async (projectId: string): Promise<ResearchProjectSnapshot> => {
    failIfConfigured('snapshot', projectId);
    await delay(getScenario(projectId).requestDelayMs ?? requestDelayMs);
    return scheduler.getSnapshot(projectId);
  };

  const getAgentReport = async (projectId: string, agentId: string): Promise<AgentReport> => {
    failIfConfigured('agent-report', projectId);
    const scenario = getScenario(projectId);
    await delay(scenario.requestDelayMs ?? requestDelayMs);
    const snapshot = scheduler.getSnapshot(projectId);
    const agent = snapshot.progress.agentTasks.find((item) => item.agentId === agentId);
    if (!agent) {
      throw new ResearchError(
        'not-found',
        `Agent ${agentId} was not found in project ${projectId}.`,
      );
    }
    const report = scenario.reports[agentId];
    if (!report) {
      throw new ResearchError(
        'not-found',
        `Agent report ${agentId} was not found in project ${projectId}.`,
      );
    }
    return copyReport(report, snapshot);
  };

  const getCompany = async (projectId: string, companyId: string): Promise<ResearchCompany> => {
    failIfConfigured('company', projectId);
    const scenario = getScenario(projectId);
    await delay(scenario.requestDelayMs ?? requestDelayMs);
    const company = scenario.companies?.find((item) => item.companyId === companyId);
    if (!company) {
      throw new ResearchError(
        'not-found',
        `Company ${companyId} was not found in project ${projectId}.`,
      );
    }
    return { ...company };
  };

  const retryAgent = async (
    projectId: string,
    agentType: string,
  ): Promise<ResearchProjectSnapshot> => {
    failIfConfigured('retry', projectId);
    const scenario = getScenario(projectId);
    await delay(scenario.requestDelayMs ?? requestDelayMs);
    return scheduler.retry(projectId, agentType);
  };

  const subscribeProjectEvents = (
    projectId: string,
    afterSeq: number,
    handlers: ResearchEventHandlers,
  ): ResearchEventSubscription => {
    try {
      getScenario(projectId);
    } catch (error) {
      handlers.onError?.(
        error instanceof ResearchError
          ? error
          : new ResearchError('not-found', 'Project not found.'),
      );
      return { unsubscribe: () => undefined };
    }

    const subscription = scheduler.subscribe(projectId, (snapshot, previousSnapshot) => {
      if (!previousSnapshot) {
        return;
      }
      const events = createEvents(previousSnapshot, snapshot, () => {
        const current = (eventSeqByProjectId.get(projectId) ?? 0) + 1;
        eventSeqByProjectId.set(projectId, current);
        return current;
      });
      for (const event of events) {
        if (event.type === 'heartbeat' || event.type === 'done' || event.type === 'message') {
          continue;
        }
        if (event.seq <= afterSeq) {
          continue;
        }
        handlers.onEvent?.(event);
      }
      // Snapshot 变化可能只体现在 result completeness 或 optional 结果字段，统一失效由 query 层重新校准。
      handlers.onSnapshotInvalidated?.();
    });
    return subscription;
  };

  return {
    listProjects,
    searchStockCandidates,
    createResearch,
    confirmResearchResolution,
    getProjectSnapshot,
    getAgentReport,
    getCompany,
    retryAgent,
    subscribeProjectEvents,
  };
}
