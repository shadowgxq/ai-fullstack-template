import { describe, expect, it } from 'vitest';

import { createMockResearchHistoryGateway } from './research-history.mock';
import type { ResearchHistoryRecord } from './research-history.types';

const RECORD_A: ResearchHistoryRecord = {
  taskId: 'task-a',
  query: '英伟达',
  objectType: 'company',
  objectName: 'NVIDIA Corporation',
  companyName: '英伟达',
  stockCode: 'NVDA',
  market: 'US',
  status: 'COMPLETED',
  conclusion: { decision: 'BUY', confidence: 'HIGH' },
  createdAt: '2026-07-20T09:00:00Z',
};

const RECORD_B: ResearchHistoryRecord = {
  taskId: 'task-b',
  query: '微信',
  objectType: 'product',
  objectName: '微信',
  companyName: '腾讯',
  stockCode: '00700',
  market: 'HK',
  status: 'FAILED',
  createdAt: '2026-07-18T09:00:00Z',
};

describe('mock 历史分析网关', () => {
  it('无 keyword 时返回全部记录，并带上正确的 total/page/size', async () => {
    const gateway = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);

    const page = await gateway.listHistory({});

    expect(page.total).toBe(2);
    expect(page.page).toBe(1);
    expect(page.size).toBe(10);
    expect(page.records.map((record) => record.taskId)).toEqual(['task-a', 'task-b']);
  });

  it('keyword 只匹配 query / objectName，大小写不敏感，支持部分匹配', async () => {
    const gateway = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);

    const byQuery = await gateway.listHistory({ keyword: '英伟达' });
    expect(byQuery.records.map((record) => record.taskId)).toEqual(['task-a']);

    const byObjectName = await gateway.listHistory({ keyword: 'nvidia' });
    expect(byObjectName.records.map((record) => record.taskId)).toEqual(['task-a']);

    // 只匹配 query/objectName，不匹配 stockCode——与文档「keyword 只匹配 query / objectName」一致。
    const byStockCode = await gateway.listHistory({ keyword: 'NVDA' });
    expect(byStockCode.records).toEqual([]);
    expect(byStockCode.total).toBe(0);
  });

  it('无命中时返回空数组而不是抛错', async () => {
    const gateway = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);

    const page = await gateway.listHistory({ keyword: '不存在的关键词' });

    expect(page.records).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('按 page/size 分页', async () => {
    const gateway = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);

    const firstPage = await gateway.listHistory({ page: 1, size: 1 });
    expect(firstPage.records.map((record) => record.taskId)).toEqual(['task-a']);
    expect(firstPage.total).toBe(2);

    const secondPage = await gateway.listHistory({ page: 2, size: 1 });
    expect(secondPage.records.map((record) => record.taskId)).toEqual(['task-b']);
  });

  it('删除后，列表不再返回该记录', async () => {
    const gateway = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);

    await gateway.deleteHistoryRecord('task-a');
    const page = await gateway.listHistory({});

    expect(page.records.map((record) => record.taskId)).toEqual(['task-b']);
    expect(page.total).toBe(1);
  });

  it('删除不存在的 taskId 时抛出 NOT_FOUND', async () => {
    const gateway = createMockResearchHistoryGateway([RECORD_A]);

    await expect(gateway.deleteHistoryRecord('missing-task')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('每个实例状态独立，互不影响', async () => {
    const first = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);
    const second = createMockResearchHistoryGateway([RECORD_A, RECORD_B]);

    await first.deleteHistoryRecord('task-a');

    const firstPage = await first.listHistory({});
    const secondPage = await second.listHistory({});

    expect(firstPage.records.map((record) => record.taskId)).toEqual(['task-b']);
    expect(secondPage.records.map((record) => record.taskId)).toEqual(['task-a', 'task-b']);
  });
});
