import { getAuthSession, onSessionChange, type AuthSession } from '../../shared/api/auth-token';
import { abortError } from '../../shared/api/errors';
import { newOperationKey } from '../wardrobe/draft';
import { emptyWearDraft, type WearDraft } from '../wear-history/draft';
import type { Selection } from './api';
import Taro from '@tarojs/taro';
import type { OutfitSession } from './session';

let pending: { session: AuthSession; key: string; draft: WearDraft } | null = null;
onSessionChange(() => {
  pending = null;
});
export function stageRecommendedWear(session: AuthSession, selection: Selection): string {
  if (getAuthSession() !== session) throw abortError();
  const key = newOperationKey();
  pending = {
    session,
    key,
    draft: {
      ...emptyWearDraft(),
      garmentIds: [...selection.selected_ids],
      recommendationRequestId: selection.request_id,
    },
  };
  return key;
}
export function recommendedWearDraft(session: AuthSession, key: string): WearDraft | null {
  if (getAuthSession() !== session || pending?.session !== session || pending.key !== key)
    return null;
  return { ...pending.draft, garmentIds: [...pending.draft.garmentIds] };
}

/** 校验可以在离页后完成，但不能由迟到续体把用户带回记录表单。 */
export async function openRecommendedWear(
  controller: OutfitSession,
  isPageActive: () => boolean,
): Promise<void> {
  if (!isPageActive()) return;
  const selection = await controller.validate();
  if (!selection || !isPageActive()) return;
  controller.assertCurrent();
  const key = stageRecommendedWear(controller.session, selection);
  await Taro.navigateTo({
    url: '/pages/wear-form/index?recommendation=' + encodeURIComponent(key),
  });
}
