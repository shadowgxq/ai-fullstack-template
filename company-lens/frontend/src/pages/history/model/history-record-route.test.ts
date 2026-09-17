import { describe, expect, it } from 'vitest';

import type { ResearchHistoryRecord } from '../../../features/research-history';
import { getHistoryRecordDestination, getHistoryRecordPath } from './history-record-route';

const baseRecord: ResearchHistoryRecord = {
  taskId: 'task/with space',
  query: 'NVIDIA',
  objectType: 'company',
  status: 'COMPLETED',
  createdAt: '2026-07-30T00:00:00Z',
};

describe('history record route mapping', () => {
  it('opens completed records in the unified result page', () => {
    expect(getHistoryRecordDestination(baseRecord)).toBe('result');
    expect(getHistoryRecordPath(baseRecord)).toBe('/research/task%2Fwith%20space/result');
  });

  it.each(['PARTIAL', 'ANALYZING', 'FAILED', 'CANCELLED', 'unknown'] as const)(
    'opens %s records in the progress page',
    (status) => {
      expect(getHistoryRecordDestination({ ...baseRecord, status })).toBe('progress');
    },
  );
});
