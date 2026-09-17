import { CompanyResearchError } from '../model/company-research.errors';
import type {
  CompanyResearchCandidate,
  CompanyResearchCapabilityResult,
  CompanyResearchEventHandlers,
  CompanyResearchEventSubscription,
  CompanyResearchHistoryPage,
  CompanyResearchLanguage,
  CompanyResearchRecognition,
  CompanyResearchReport,
  CompanyResearchTask,
} from '../model/company-research.types';
import type { CompanyResearchRepository } from './company-research.repository';

const STORAGE_KEY = 'ai-berkshire.company-research.mock.v1';
const STAGES = [
  'object-recognition',
  'company-profile',
  'business-analysis',
  'financial-analysis',
  'management-analysis',
  'risk-valuation',
  'report-synthesis',
] as const;

type MockState = {
  tasks: Record<string, CompanyResearchTask>;
  reports: Record<string, CompanyResearchReport>;
  recognitions: Record<string, CompanyResearchRecognition>;
};

function readState(): MockState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // A private browsing context may disable localStorage.
  }
  return { tasks: {}, reports: {}, recognitions: {} };
}

function writeState(state: MockState): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // In-memory behavior remains usable for the current request.
  }
}

function candidate(
  candidateId: string,
  objectName: string,
  companyName: string,
  stockCode: string,
  market: string,
  extra: Partial<CompanyResearchCandidate> = {},
): CompanyResearchCandidate {
  return {
    candidateId,
    objectName,
    objectType: 'company',
    companyName,
    stockCode,
    market,
    canResearch: true,
    ...extra,
  };
}

function resolveCandidates(query: string): readonly CompanyResearchCandidate[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.includes('王兴')) {
    return [
      candidate('meituan-person', '王兴', '美团', '3690', 'HK', {
        objectType: 'person',
        relation: '创始人、董事长兼 CEO',
      }),
    ];
  }
  if (normalized.includes('黄仁勋')) {
    return [
      candidate('nvidia-person', '黄仁勋', 'NVIDIA Corporation', 'NVDA', 'NASDAQ', {
        objectType: 'person',
        relation: '创始人兼 CEO',
      }),
    ];
  }
  if (normalized.includes('微信')) {
    return [
      candidate('wechat-product', '微信', '腾讯控股', '0700', 'HK', {
        objectType: 'product',
        relation: '核心产品',
      }),
    ];
  }
  if (normalized.includes('美团') || normalized === '3690') {
    return [candidate('meituan', '美团', '美团', '3690', 'HK')];
  }
  return [candidate('nvidia', query.trim(), 'NVIDIA Corporation', 'NVDA', 'NASDAQ')];
}

function createReport(task: CompanyResearchTask): CompanyResearchReport {
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      financialDataAsOf: '2026-06-30',
      marketDataAsOf: '2026-07-27',
    },
    overall_conclusion: {
      decision: task.conclusion?.decision ?? 'HOLD',
      confidence: task.conclusion?.confidence ?? 'HIGH',
      companyQuality: '优秀',
      valuationStatus: '估值偏高',
      longTermOutlook: '长期需求仍有结构性支撑',
      biggestOpportunity: '平台与生态持续扩张',
      biggestRisk: '高估值对增长兑现要求较高',
    },
    direct_answer: `${task.objectName ?? task.query} 对应的上市公司具备持续研究价值，但应等待更合理的安全边际。`,
    business_model: { judgment: '核心业务具有规模效应与较高的增量利润率。' },
    moat: { judgment: '技术积累、生态和客户迁移成本共同构成护城河。' },
    financial_quality: { judgment: '现金流质量良好，需持续观察资本开支回报。' },
    industry_competition: { judgment: '行业长期空间较大，竞争与替代风险并存。' },
    management: { judgment: '战略执行记录较强，关键人物依赖需要持续跟踪。' },
    risks: ['估值压缩', '竞争加剧', '监管与供应链变化'],
    valuation: { status: '偏高', approach: '历史区间与情景现金流交叉验证' },
    perspectives: ['长期持有视角', '逆向风险视角', '资本配置视角'],
    consensus: '公司质量较高，短期价格决定预期回报。',
    disagreements: '增长持续时间与合理估值中枢仍有分歧。',
    bull_case: '需求扩张和平台化提升长期自由现金流。',
    bear_case: '增长放缓与估值下修同时发生。',
    watch_items: ['收入增速', '自由现金流率', '主要客户集中度'],
    sources: [
      { title: 'Company annual report', url: 'https://www.sec.gov/', accessedAt: '2026-07-27' },
    ],
    warnings: ['本报告仅用于研究辅助，不构成投资建议。'],
  };
}

function createMockTask(
  state: MockState,
  input: Readonly<{
    recognitionId: string;
    candidateId: string;
    query?: string;
    conversationId?: string;
    language?: CompanyResearchLanguage;
  }>,
): CompanyResearchTask {
  const recognition = state.recognitions[input.recognitionId];
  const selected = recognition?.candidates.find((item) => item.candidateId === input.candidateId);
  if (!selected?.canResearch)
    throw new CompanyResearchError('contract-invalid', 'Candidate is not researchable.');
  const taskId = `mock-${Date.now()}`;
  const isPartial = selected.objectName.includes('部分');
  const isFailed = selected.objectName.includes('失败');
  const status = isFailed ? 'failed' : isPartial ? 'partial' : 'completed';
  const task: CompanyResearchTask = {
    taskId,
    query: selected.objectName,
    language: input.language ?? 'zh-CN',
    status,
    objectType: selected.objectType,
    objectName: selected.objectName,
    companyName: selected.companyName,
    stockCode: selected.stockCode,
    market: selected.market,
    industry: '信息技术',
    objectRelation: selected.relation,
    researchFocus: '公司质量、长期前景与估值安全边际',
    reportReady: !isFailed,
    failReason: isFailed
      ? '资料收集服务暂时不可用。'
      : isPartial
        ? '管理层深度研究未完成，相关结论置信度降低。'
        : undefined,
    capabilities: [
      { name: 'investment_research', displayName: '公司基本面', status: 'succeeded' },
      { name: 'investment_team', displayName: '专家团队', status: 'succeeded' },
      {
        name: 'management_deep_dive',
        displayName: '管理层深度研究',
        status: isFailed || isPartial ? 'failed' : 'succeeded',
      },
      { name: 'synthesis', displayName: '综合结论', status: isFailed ? 'failed' : 'succeeded' },
    ],
    stages: STAGES.map((key, index) => ({
      key,
      status: isFailed && index > 3 ? 'failed' : 'completed',
    })),
    conclusion: {
      decision: 'HOLD',
      confidence: isPartial ? 'MEDIUM' : 'HIGH',
      companyQuality: 'HIGH',
    },
    canBind: true,
    isBound: false,
    createdAt: new Date().toISOString(),
    completedAt: isFailed ? undefined : new Date().toISOString(),
  };
  state.tasks[taskId] = task;
  if (!isFailed) state.reports[taskId] = createReport(task);
  writeState(state);
  return task;
}

export function createCompanyResearchMockRepository(): CompanyResearchRepository {
  const state = readState();
  const recognitionStreams = new Map<
    string,
    { handlers: CompanyResearchEventHandlers; isClosed: () => boolean }
  >();
  return {
    subscribeRecognition(query, handlers): CompanyResearchEventSubscription {
      const recognitionId = `rec-${Date.now()}`;
      const conversationId = `conversation-${Date.now()}`;
      let closed = false;
      const subscription: CompanyResearchEventSubscription = {
        close: () => {
          closed = true;
          recognitionStreams.delete(conversationId);
        },
      };
      recognitionStreams.set(conversationId, { handlers, isClosed: () => closed });

      globalThis.setTimeout(() => {
        if (closed) return;
        const lower = query.toLocaleLowerCase();
        let recognition: CompanyResearchRecognition;
        if (lower.includes('无法识别')) {
          recognition = { recognitionId, status: 'unresolved', candidates: [] };
        } else if (lower.includes('非上市') || lower.includes('不可研究')) {
          recognition = {
            recognitionId,
            status: 'unsupported',
            candidates: [],
            message: '该对象无法对应到可研究的上市公司。',
          };
        } else if (lower.includes('apple') || lower.includes('苹果')) {
          recognition = {
            recognitionId,
            status: 'ambiguous',
            candidates: [
              candidate('apple-inc', 'Apple', 'Apple Inc.', 'AAPL', 'NASDAQ'),
              candidate(
                'apple-hospitality',
                'Apple Hospitality REIT',
                'Apple Hospitality REIT, Inc.',
                'APLE',
                'NYSE',
              ),
              candidate('apple-private', '苹果示例品牌', '苹果示例品牌', '-', '-', {
                canResearch: false,
                disabledReason: '未对应到上市公司',
              }),
            ],
          };
        } else {
          const candidates = resolveCandidates(query);
          recognition = {
            recognitionId,
            status: 'resolved',
            selectedCandidateId: candidates[0]?.candidateId,
            candidates,
          };
        }
        recognition = { ...recognition, conversationId };
        state.recognitions[recognitionId] = recognition;
        writeState(state);

        handlers.onEvent({
          type: 'recognition_started',
          conversationId,
          query,
          isTerminal: false,
        });
        handlers.onEvent({
          type: 'recognition_result',
          conversationId,
          recognitionId,
          status: recognition.status,
          selectedCandidateId: recognition.selectedCandidateId,
          recognition,
          isTerminal: false,
        });

        if (recognition.status === 'resolved' && recognition.selectedCandidateId) {
          const task = createMockTask(state, {
            recognitionId,
            candidateId: recognition.selectedCandidateId,
            query,
            conversationId,
          });
          handlers.onEvent({
            type: 'status_change',
            taskId: task.taskId,
            status: 'COMPLETED',
            isTerminal: false,
          });
          handlers.onEvent({ type: 'task_complete', taskId: task.taskId, isTerminal: true });
          recognitionStreams.delete(conversationId);
        } else if (recognition.status === 'unresolved' || recognition.status === 'unsupported') {
          handlers.onEvent({
            type: 'recognition_error',
            status: recognition.status,
            message: recognition.message ?? '无法识别的研究对象',
            isTerminal: false,
          });
          handlers.onEvent({ type: 'done', isTerminal: true });
          recognitionStreams.delete(conversationId);
        }
      }, 0);

      return subscription;
    },
    async createTask(input) {
      const task = createMockTask(state, input);
      const stream = input.conversationId
        ? recognitionStreams.get(input.conversationId)
        : undefined;
      if (stream && !stream.isClosed()) {
        stream.handlers.onEvent({
          type: 'status_change',
          taskId: task.taskId,
          status: 'COMPLETED',
          isTerminal: false,
        });
        stream.handlers.onEvent({ type: 'task_complete', taskId: task.taskId, isTerminal: true });
        recognitionStreams.delete(input.conversationId as string);
      }
      return task;
    },
    async getTask(taskId) {
      const task = state.tasks[taskId];
      if (!task) throw new CompanyResearchError('not-found', 'Task not found.', { status: 404 });
      return task;
    },
    async getReport(taskId) {
      const report = state.reports[taskId];
      if (!report)
        throw new CompanyResearchError('not-found', 'Report not found.', { status: 404 });
      return { report };
    },
    async getCapabilityResult(taskId, capability): Promise<CompanyResearchCapabilityResult> {
      const task = state.tasks[taskId];
      if (!task) throw new CompanyResearchError('not-found', 'Task not found.', { status: 404 });
      const capabilityState = task.capabilities.find((item) => item.name === capability);
      if (capabilityState?.status !== 'succeeded') {
        throw new CompanyResearchError('not-found', 'Capability result not found.', {
          status: 404,
        });
      }
      return {
        agentName: capability,
        reportReady: true,
        reportMarkdown: `# ${capabilityState.displayName ?? capability}\n\nMock capability report.`,
        normalizedOutput: { decision: 'HOLD' },
        sources: [{ title: 'Company annual report', url: 'https://www.sec.gov/' }],
      };
    },
    async retryCapability(taskId, capability) {
      const task = state.tasks[taskId];
      if (!task) throw new CompanyResearchError('not-found', 'Task not found.', { status: 404 });
      state.tasks[taskId] = {
        ...task,
        status: 'completed',
        reportReady: true,
        failReason: undefined,
        capabilities: task.capabilities.map((item) =>
          item.name === capability ? { ...item, status: 'succeeded' } : item,
        ),
      };
      state.reports[taskId] = createReport(state.tasks[taskId]);
      writeState(state);
    },
    async retryReport(taskId) {
      const task = state.tasks[taskId];
      if (!task) throw new CompanyResearchError('not-found', 'Task not found.', { status: 404 });
      state.tasks[taskId] = {
        ...task,
        status: 'collecting',
        reportReady: false,
        finalResultAvailable: false,
        failReason: undefined,
      };
      delete state.reports[taskId];
      writeState(state);
    },
    async listHistory(input): Promise<CompanyResearchHistoryPage> {
      // TODO(company-research-api): GAP-004 - Remove mock multi-field AND search after the API supports it.
      const terms = input.keyword?.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
      const allItems = Object.values(state.tasks)
        .filter((task) =>
          terms.every((term) =>
            [
              task.query,
              task.objectName,
              task.companyName,
              task.stockCode,
              task.market,
              task.researchFocus,
            ]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase()
              .includes(term),
          ),
        )
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      const start = (input.page - 1) * input.size;
      return {
        items: allItems.slice(start, start + input.size),
        page: input.page,
        size: input.size,
        total: allItems.length,
      };
    },
    async deleteHistory(taskId) {
      if (!state.tasks[taskId])
        throw new CompanyResearchError('not-found', 'Task not found.', { status: 404 });
      delete state.tasks[taskId];
      delete state.reports[taskId];
      writeState(state);
    },
    async bindTask(taskId) {
      const task = state.tasks[taskId];
      if (!task) throw new CompanyResearchError('not-found', 'Task not found.', { status: 404 });
      const bound = { ...task, canBind: false, isBound: true };
      state.tasks[taskId] = bound;
      writeState(state);
    },
    subscribeEvents() {
      return { close: () => undefined };
    },
  };
}
