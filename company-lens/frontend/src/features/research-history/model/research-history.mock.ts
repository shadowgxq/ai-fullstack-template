import { ResearchHistoryError, type ResearchHistoryGateway } from './research-history.gateway';
import type { ListResearchHistoryParams, ResearchHistoryRecord } from './research-history.types';

const MOCK_LATENCY_MS = 280;
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 演示种子数据，取材自需求文档第二十章 20.2/20.3 的示例（黄仁勋/NVIDIA、英伟达、微信、
 * 美团外卖），覆盖任务状态、对象类型和字段缺失（进行中任务尚未解析出公司/市场）等场景。
 */
const DEFAULT_SEED_RECORDS: readonly ResearchHistoryRecord[] = [
  {
    taskId: 'mock-history-0001',
    query: '英伟达',
    objectType: 'company',
    objectName: 'NVIDIA Corporation',
    createdAt: '2026-07-26T08:00:00Z',
    status: 'ANALYZING',
  },
  {
    taskId: 'mock-history-0002',
    query: '黄仁勋',
    objectType: 'person',
    objectName: '黄仁勋',
    companyName: 'NVIDIA',
    stockCode: 'NVDA',
    market: 'US',
    status: 'COMPLETED',
    conclusion: { decision: 'HOLD', confidence: 'HIGH' },
    createdAt: '2026-07-24T09:00:00Z',
  },
  {
    taskId: 'mock-history-0003',
    query: '美团 外卖',
    objectType: 'business',
    objectName: '美团外卖',
    companyName: '美团',
    stockCode: '3690',
    market: 'HK',
    status: 'COMPLETED',
    conclusion: { decision: 'HOLD', confidence: 'MEDIUM' },
    createdAt: '2026-07-18T09:00:00Z',
  },
  {
    taskId: 'mock-history-0004',
    query: '微信',
    objectType: 'product',
    objectName: '微信',
    companyName: '腾讯',
    stockCode: '00700',
    market: 'HK',
    status: 'FAILED',
    createdAt: '2026-07-15T09:00:00Z',
  },
];

function matchesKeyword(record: ResearchHistoryRecord, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase();
  return (
    record.query.toLowerCase().includes(normalizedKeyword) ||
    (record.objectName ?? '').toLowerCase().includes(normalizedKeyword)
  );
}

/**
 * 创建一个状态独立的 mock 历史分析网关。
 *
 * 记录表是闭包私有状态，测试可以为每个用例创建全新实例，避免用例间相互污染；
 * 与 `features/auth` 的 `createMockAuthGateway` 保持同一模式。
 *
 * @param seedRecords 初始记录；默认取上面的演示种子数据，测试可以传入自定义集合。
 */
export function createMockResearchHistoryGateway(
  seedRecords: readonly ResearchHistoryRecord[] = DEFAULT_SEED_RECORDS,
): ResearchHistoryGateway {
  // 闭包私有的可变列表，只属于这一个网关实例。
  let records = [...seedRecords];

  return {
    async listHistory(params: ListResearchHistoryParams) {
      await delay(MOCK_LATENCY_MS);
      const trimmedKeyword = params.keyword?.trim();
      const page = params.page && params.page > 0 ? params.page : DEFAULT_PAGE;
      const size = params.size && params.size > 0 ? params.size : DEFAULT_SIZE;

      const filtered = trimmedKeyword
        ? records.filter((record) => matchesKeyword(record, trimmedKeyword))
        : records;

      const start = (page - 1) * size;
      return {
        total: filtered.length,
        page,
        size,
        records: filtered.slice(start, start + size),
      };
    },

    async deleteHistoryRecord(taskId: string) {
      await delay(120);
      const exists = records.some((record) => record.taskId === taskId);
      if (!exists) {
        throw new ResearchHistoryError('NOT_FOUND');
      }
      records = records.filter((record) => record.taskId !== taskId);
    },

    async retryReport(taskId: string) {
      await delay(120);
      const record = records.find((item) => item.taskId === taskId);
      if (!record) {
        throw new ResearchHistoryError('NOT_FOUND');
      }
      records = records.map((item) =>
        item.taskId === taskId
          ? {
              ...item,
              status: 'COLLECTING',
              finalResultAvailable: false,
              synthesisFailed: true,
            }
          : item,
      );
    },
  };
}

/** 应用运行时使用的实例；research-history.source.ts 按 VITE_DATA_SOURCE 单点切换数据源。 */
export const mockResearchHistoryGateway: ResearchHistoryGateway =
  createMockResearchHistoryGateway();
