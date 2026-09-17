import type { ResearchHistoryRecord } from '../../../features/research-history';

export type HistoryRecordDestination = 'result' | 'progress';

/** 历史列表没有 reportReady 字段，因此只有明确完成的任务进入总结页。 */
export function getHistoryRecordDestination(
  record: ResearchHistoryRecord,
): HistoryRecordDestination {
  return record.status === 'COMPLETED' ? 'result' : 'progress';
}

export function getHistoryRecordPath(record: ResearchHistoryRecord): string {
  const destination = getHistoryRecordDestination(record);
  return `/research/${encodeURIComponent(record.taskId)}/${destination}`;
}
