import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { removeResearchHistoryRecord } from './research-history.queries';
import type { ResearchHistoryPage } from './research-history.types';

function buildRecord(taskId: string): ResearchHistoryPage['records'][number] {
  return {
    taskId,
    query: taskId,
    objectType: 'company',
    status: 'COMPLETED',
    createdAt: '2026-07-27T10:00:00Z',
  };
}

describe('removeResearchHistoryRecord', () => {
  it('从命中的那一页移除记录，并把每一页的 total 都减一', () => {
    const data: InfiniteData<ResearchHistoryPage> = {
      pages: [
        { total: 3, page: 1, size: 2, records: [buildRecord('a'), buildRecord('b')] },
        { total: 3, page: 2, size: 2, records: [buildRecord('c')] },
      ],
      pageParams: [1, 2],
    };

    const next = removeResearchHistoryRecord(data, 'b');

    expect(next.pages[0].records.map((record) => record.taskId)).toEqual(['a']);
    expect(next.pages[0].total).toBe(2);
    expect(next.pages[1].records.map((record) => record.taskId)).toEqual(['c']);
    expect(next.pages[1].total).toBe(2);
  });

  it('taskId 不存在时原样返回同一个引用（不产生无意义的重渲染）', () => {
    const data: InfiniteData<ResearchHistoryPage> = {
      pages: [{ total: 1, page: 1, size: 10, records: [buildRecord('a')] }],
      pageParams: [1],
    };

    const next = removeResearchHistoryRecord(data, 'missing');

    expect(next).toBe(data);
  });

  it('total 不会减到负数', () => {
    const data: InfiniteData<ResearchHistoryPage> = {
      pages: [{ total: 0, page: 1, size: 10, records: [buildRecord('a')] }],
      pageParams: [1],
    };

    const next = removeResearchHistoryRecord(data, 'a');

    expect(next.pages[0].total).toBe(0);
    expect(next.pages[0].records).toEqual([]);
  });
});
