import type { MarketCode } from '../../market';
import { RESEARCH_AGENT_TYPES } from '../model/research.constants';
import type {
  AgentReport,
  ResearchAgentStatus,
  ResearchEvidence,
  ResearchProjectSnapshot,
  ResearchProjectStatus,
  ResearchResultCompleteness,
} from '../model/research.types';
import { assertMockFixtureSuite } from './research-fixture-validator';
import type { MockResearchScenario } from '../api/mock/mock-research.types';
import { createIndustryResearchMarkdown } from '../api/mock/mock-research.content';

const AGENT_DISPLAY_NAMES = [
  'Industry Research',
  'Bottleneck Hunter',
  'Quality Screen',
  'Industry Funnel',
  'Investment Checklist',
] as const;

const LONG_RESEARCH_QUERY =
  '全球人工智能基础设施、算力供给、芯片产业链与能源约束的长期投资机会及主要风险';
const LONG_COMPANY_NAME = 'Advanced Global Artificial Intelligence Infrastructure Holdings';

type SnapshotOptions = {
  projectId: string;
  query: string;
  objectType: 'industry' | 'theme' | 'company';
  market: MarketCode;
  status: ResearchProjectStatus;
  progressPercent?: number;
  resultCompleteness: ResearchResultCompleteness;
  agentStatuses: readonly ResearchAgentStatus[];
  reportReady?: readonly boolean[];
  conclusion?: string;
  maxRisk?: string;
  consensus?: string;
  divergence?: string;
  dataSources?: string;
  companyId?: string;
  companyName?: string;
  ticker?: string;
  reason?: string;
  missingReports?: readonly string[];
  evidenceGaps?: readonly string[];
  limitations?: readonly string[];
  omitOptionalFields?: boolean;
};

function agentId(projectId: string, index: number): string {
  return `${projectId}-agent-${index + 1}`;
}

function createSnapshot(options: SnapshotOptions): ResearchProjectSnapshot {
  const agentTasks = RESEARCH_AGENT_TYPES.map((agentType, index) => {
    const status = options.agentStatuses[index] ?? 'waiting';
    const reportReady = options.reportReady?.[index] ?? false;
    return {
      agentId: agentId(options.projectId, index),
      agentType,
      displayName: AGENT_DISPLAY_NAMES[index],
      displayOrder: index + 1,
      status,
      ...(status === 'running' && options.progressPercent !== undefined
        ? { progressPercent: Math.min(99, Math.max(1, options.progressPercent - index * 7)) }
        : {}),
      ...(status === 'completed' ? { summary: `${AGENT_DISPLAY_NAMES[index]} completed.` } : {}),
      ...(status === 'failed'
        ? { errorMessage: 'The fixture intentionally blocks this Agent.' }
        : {}),
      reportReady,
      canRetry: status === 'failed',
    };
  });

  const finalists =
    options.companyName || options.ticker || options.companyId
      ? [
          {
            ...(options.companyName ? { companyName: options.companyName } : {}),
            ...(options.ticker ? { ticker: options.ticker } : {}),
            rankNo: 1,
            ...(options.reason ? { reason: options.reason } : {}),
            ...(options.companyId ? { companyId: options.companyId } : {}),
          },
        ]
      : [];

  const shouldIncludeResultText = options.resultCompleteness !== 'unavailable';
  return {
    project: {
      projectId: options.projectId,
      query: options.query,
      objectType: options.objectType,
      market: options.market,
      status: options.status,
      ...(!options.omitOptionalFields ? { normalizedName: options.query } : {}),
      ...(!options.omitOptionalFields ? { createdAt: '2026-07-21 09:00:00' } : {}),
      ...(!options.omitOptionalFields ? { updatedAt: '2026-07-21 09:12:00' } : {}),
    },
    progress: {
      projectId: options.projectId,
      status: options.status,
      ...(options.progressPercent !== undefined
        ? { progressPercent: options.progressPercent }
        : {}),
      resultReady: options.resultCompleteness !== 'unavailable',
      resultCompleteness: options.resultCompleteness,
      agentTasks,
      ...(agentTasks.some((agent) => agent.status === 'failed')
        ? {
            failedAgentTypes: agentTasks
              .filter((agent) => agent.status === 'failed')
              .map((agent) => agent.agentType),
          }
        : {}),
      ...(shouldIncludeResultText
        ? { progressMessage: 'The server read model controls this progress state.' }
        : {}),
    },
    result: {
      projectId: options.projectId,
      researchMode: options.objectType,
      resultReady: options.resultCompleteness !== 'unavailable',
      resultCompleteness: options.resultCompleteness,
      ...(shouldIncludeResultText && options.conclusion ? { conclusion: options.conclusion } : {}),
      ...(shouldIncludeResultText && options.maxRisk ? { maxRisk: options.maxRisk } : {}),
      ...(shouldIncludeResultText && options.consensus ? { consensus: options.consensus } : {}),
      ...(shouldIncludeResultText && options.divergence ? { divergence: options.divergence } : {}),
      ...(shouldIncludeResultText && options.dataSources
        ? { dataSources: options.dataSources }
        : {}),
      ...(options.missingReports ? { missingReports: [...options.missingReports] } : {}),
      ...(options.evidenceGaps ? { evidenceGaps: [...options.evidenceGaps] } : {}),
      ...(options.limitations ? { limitations: [...options.limitations] } : {}),
      ...(finalists.length > 0 ? { finalists } : {}),
    },
  };
}

function createReports(
  projectId: string,
  statuses: readonly ResearchAgentStatus[],
  reportReady: readonly boolean[],
  longContent = false,
): Readonly<Record<string, AgentReport>> {
  return Object.fromEntries(
    RESEARCH_AGENT_TYPES.map((agentType, index) => {
      const available = reportReady[index] ?? false;
      const status = statuses[index] ?? 'waiting';
      const content =
        agentType === 'industry_research'
          ? createIndustryResearchMarkdown({
              query: longContent ? LONG_RESEARCH_QUERY : 'AI 算力基础设施',
              market: 'Mock',
            })
          : longContent
            ? `${LONG_RESEARCH_QUERY}。${LONG_RESEARCH_QUERY}。该段文本专门覆盖报告容器的长内容换行边界。`
            : `${AGENT_DISPLAY_NAMES[index]} report content from a development fixture.`;
      const evidence: ResearchEvidence = {
        category: 'source',
        content: `Fixture source for ${agentType}.`,
      };
      const report: AgentReport = {
        projectId,
        agentId: agentId(projectId, index),
        agentType,
        status,
        reportStatus: available ? 'available' : 'unavailable',
        reportReady: available,
        ...(available ? { rawReport: content, sources: [evidence] } : {}),
        ...(available
          ? {
              blocks: [
                {
                  stage: 'REPORT' as const,
                  content,
                  contentType: 'MARKDOWN' as const,
                  messageIds: [`${projectId}-message-${index + 1}`],
                },
              ],
            }
          : {}),
        ...(status === 'failed'
          ? { errorMessage: 'The fixture intentionally blocks this Agent.' }
          : {}),
      };
      return [agentId(projectId, index), report];
    }),
  );
}

const runningIndustryUs = (() => {
  const projectId = 'mock-research-industry-us-0001';
  const runningStatuses: readonly ResearchAgentStatus[] = [
    'running',
    'running',
    'running',
    'waiting',
    'waiting',
  ];
  const completedStatuses: readonly ResearchAgentStatus[] = [
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
  ];
  return {
    scenarioId: 'industry-running',
    projectId,
    objectType: 'industry',
    market: 'US',
    description: '行业研究的进行中状态；三个 Agent 并行只是 fixture 展示数据，不是调度依赖。',
    timeline: [
      {
        afterMs: 0,
        snapshot: createSnapshot({
          projectId,
          query: 'AI 算力基础设施',
          objectType: 'industry',
          market: 'US',
          status: 'running',
          progressPercent: 18,
          resultCompleteness: 'unavailable',
          agentStatuses: runningStatuses,
        }),
      },
      {
        afterMs: 1200,
        snapshot: createSnapshot({
          projectId,
          query: 'AI 算力基础设施',
          objectType: 'industry',
          market: 'US',
          status: 'running',
          progressPercent: 58,
          resultCompleteness: 'unavailable',
          agentStatuses: ['completed', 'running', 'running', 'running', 'waiting'],
        }),
      },
      {
        afterMs: 2400,
        snapshot: createSnapshot({
          projectId,
          query: 'AI 算力基础设施',
          objectType: 'industry',
          market: 'US',
          status: 'completed',
          progressPercent: 100,
          resultCompleteness: 'full',
          agentStatuses: completedStatuses,
          reportReady: [true, true, true, true, true],
          conclusion: '数据中心、芯片和能源约束构成产业链的关键观察点。',
          maxRisk: '资本开支周期和供应链集中度可能放大回撤。',
          consensus: '行业长期需求仍具韧性。',
          divergence: '短期盈利兑现速度存在分歧。',
          dataSources: 'development fixture sources',
        }),
      },
    ],
    reports: createReports(projectId, completedStatuses, [true, true, true, true, true]),
    coverage: {
      hasLongContent: false,
      hasMissingOptionalFields: false,
      supportsReentry: true,
      hasFailureBlockedState: false,
      hasRetryProgression: false,
    },
  } satisfies MockResearchScenario;
})();

const fullThemeCn = (() => {
  const projectId = 'mock-research-theme-cn-0002';
  const statuses: readonly ResearchAgentStatus[] = [
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
  ];
  return {
    scenarioId: 'theme-full',
    projectId,
    objectType: 'theme',
    market: 'CN',
    description: '完整主题研究，保留五个 Agent 的稳定顺序和完整报告。',
    timeline: [
      {
        afterMs: 0,
        snapshot: createSnapshot({
          projectId,
          query: LONG_RESEARCH_QUERY,
          objectType: 'theme',
          market: 'CN',
          status: 'completed',
          progressPercent: 100,
          resultCompleteness: 'full',
          agentStatuses: statuses,
          reportReady: [true, true, true, true, true],
          conclusion: '完整主题样本只表达服务端已经给出的结论。',
          maxRisk: '行业景气与估值波动。',
          consensus: '基本面改善具备持续观察价值。',
          divergence: '不同 Agent 对兑现节奏的判断不同。',
          dataSources: 'development fixture sources',
        }),
      },
    ],
    reports: createReports(projectId, statuses, [true, true, true, true, true], true),
    coverage: {
      hasLongContent: true,
      hasMissingOptionalFields: false,
      supportsReentry: true,
      hasFailureBlockedState: false,
      hasRetryProgression: false,
    },
  } satisfies MockResearchScenario;
})();

const partialCompanyHk = (() => {
  const projectId = 'mock-research-company-hk-0003';
  const companyId = `${projectId}-company-1`;
  const statuses: readonly ResearchAgentStatus[] = [
    'completed',
    'completed',
    'failed',
    'completed',
    'waiting',
  ];
  return {
    scenarioId: 'company-partial',
    projectId,
    objectType: 'company',
    market: 'HK',
    description: '单公司 partial 结果，故意缺失评分和部分报告，不能包装成替代推荐。',
    timeline: [
      {
        afterMs: 0,
        snapshot: createSnapshot({
          projectId,
          query: '腾讯控股',
          objectType: 'company',
          market: 'HK',
          status: 'completed',
          progressPercent: 76,
          resultCompleteness: 'partial',
          agentStatuses: statuses,
          reportReady: [true, true, false, true, false],
          conclusion:
            '目标公司在其行业位置上的竞争优势仍需结合缺失报告验证，当前结论只能作为待验证的研究线索。',
          maxRisk:
            '监管、竞争格局和外部需求可能同时变化；在缺失质量筛选报告、证据链尚未闭合且估值数据未完成交叉验证的情况下，不应将该风险压缩为单一指标或确定性判断。',
          reason:
            '目标公司在当前研究范围内具备代表性，但入选理由仍依赖后续补充报告、最新财务数据和跨来源核验，不能被解释为对其他公司的替代推荐。',
          missingReports: ['quality_screen', 'investment_checklist'],
          evidenceGaps: ['缺少质量筛选 Agent 的独立证据', '关键估值与现金流数据尚未完成交叉核验'],
          limitations: [
            '本 fixture 只表达 partial 研究状态，不提供默认置信度或质量评分。',
            '长文本风险和入选理由必须完整保留，页面不得截断为确定性结论。',
          ],
          companyId,
          companyName: LONG_COMPANY_NAME,
          ticker: '0700.HK',
          omitOptionalFields: true,
        }),
      },
    ],
    reports: createReports(projectId, statuses, [true, true, false, true, false]),
    companies: [
      {
        projectId,
        companyId,
        companyName: LONG_COMPANY_NAME,
        ticker: '0700.HK',
        market: 'HK',
        conclusion: '这是目标公司的详情结论。',
        whySelected: '目标公司在行业位置上具备代表性。',
        risks: ['竞争投入', '政策变化'],
        nextValidation: ['核对下一期现金流和竞争格局'],
      },
    ],
    coverage: {
      hasLongContent: false,
      hasMissingOptionalFields: true,
      supportsReentry: true,
      hasFailureBlockedState: false,
      hasRetryProgression: false,
    },
  } satisfies MockResearchScenario;
})();

const failureBlockedJp = (() => {
  const projectId = 'mock-research-failure-jp-0004';
  const statuses: readonly ResearchAgentStatus[] = [
    'completed',
    'failed',
    'waiting',
    'waiting',
    'waiting',
  ];
  return {
    scenarioId: 'failure-blocked',
    projectId,
    objectType: 'industry',
    market: 'JP',
    description: '失败阻断样本，结果不可用且不拼接统一结论。',
    timeline: [
      {
        afterMs: 0,
        snapshot: createSnapshot({
          projectId,
          query: '日本机器人产业链',
          objectType: 'industry',
          market: 'JP',
          status: 'failed',
          progressPercent: 42,
          resultCompleteness: 'unavailable',
          agentStatuses: statuses,
          reportReady: [true, false, false, false, false],
          omitOptionalFields: true,
        }),
      },
    ],
    reports: createReports(projectId, statuses, [true, false, false, false, false]),
    coverage: {
      hasLongContent: false,
      hasMissingOptionalFields: true,
      supportsReentry: true,
      hasFailureBlockedState: true,
      hasRetryProgression: false,
    },
  } satisfies MockResearchScenario;
})();

const retryThemeKr = (() => {
  const projectId = 'mock-research-retry-theme-0005';
  const initialStatuses: readonly ResearchAgentStatus[] = [
    'completed',
    'failed',
    'completed',
    'waiting',
    'waiting',
  ];
  const retryRunningStatuses: readonly ResearchAgentStatus[] = [
    'completed',
    'running',
    'running',
    'waiting',
    'waiting',
  ];
  const finalStatuses: readonly ResearchAgentStatus[] = [
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
  ];
  return {
    scenarioId: 'retry-progresses',
    projectId,
    objectType: 'theme',
    market: 'KR',
    description: '可重试样本；同一 projectId 从 partial 进入 retry timeline，最终变为 full。',
    timeline: [
      {
        afterMs: 0,
        snapshot: createSnapshot({
          projectId,
          query: '韩国先进制造主题',
          objectType: 'theme',
          market: 'KR',
          status: 'completed',
          progressPercent: 64,
          resultCompleteness: 'partial',
          agentStatuses: initialStatuses,
          reportReady: [true, false, true, false, false],
        }),
      },
    ],
    retry: {
      agentType: RESEARCH_AGENT_TYPES[1],
      timeline: [
        {
          afterMs: 0,
          snapshot: createSnapshot({
            projectId,
            query: '韩国先进制造主题',
            objectType: 'theme',
            market: 'KR',
            status: 'running',
            progressPercent: 67,
            resultCompleteness: 'partial',
            agentStatuses: retryRunningStatuses,
            reportReady: [true, false, true, false, false],
          }),
        },
        {
          afterMs: 1400,
          snapshot: createSnapshot({
            projectId,
            query: '韩国先进制造主题',
            objectType: 'theme',
            market: 'KR',
            status: 'completed',
            progressPercent: 100,
            resultCompleteness: 'full',
            agentStatuses: finalStatuses,
            reportReady: [true, true, true, true, true],
            conclusion: '重试完成后才出现完整主题结论。',
            maxRisk: '周期波动。',
          }),
        },
      ],
    },
    reports: createReports(projectId, finalStatuses, [true, true, true, true, true]),
    coverage: {
      hasLongContent: false,
      hasMissingOptionalFields: false,
      supportsReentry: true,
      hasFailureBlockedState: false,
      hasRetryProgression: true,
    },
  } satisfies MockResearchScenario;
})();

/**
 * Fixture suite 是开发态契约样本，不代表真实服务端会按这些时间或顺序调度 Agent。
 * 每个 scenario 故意覆盖一个产品边界，模块加载时统一校验，防止演示数据悄悄失去矩阵覆盖。
 */
export const MOCK_RESEARCH_SCENARIOS: readonly MockResearchScenario[] = [
  runningIndustryUs,
  fullThemeCn,
  partialCompanyHk,
  failureBlockedJp,
  retryThemeKr,
];

assertMockFixtureSuite(MOCK_RESEARCH_SCENARIOS);
