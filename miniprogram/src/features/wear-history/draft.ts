import { shanghaiToday, validateWearDate } from './date';

/** 仅供页面编辑的草稿；网络载荷由生成契约的消费者转换。 */
export interface WearDraft {
  wearDate: string;
  garmentIds: string[];
  recommendationRequestId?: string;
}
export function emptyWearDraft(now: number = Date.now()): WearDraft {
  return { wearDate: shanghaiToday(now), garmentIds: [] };
}
export function validateWearDraft(draft: WearDraft, now: number = Date.now()): string | null {
  if (draft.recommendationRequestId && draft.garmentIds.length > 64)
    return '推荐确认最多选择 64 件衣物；更多衣物请明确改为手动补录';
  if (draft.garmentIds.length > 1000) return '每条记录最多选择 1000 件衣物';
  return (
    validateWearDate(draft.wearDate, now) ??
    (draft.garmentIds.length ? null : '请选择至少一件实际穿过的衣物')
  );
}
