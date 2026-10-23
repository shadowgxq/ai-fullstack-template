import Taro from '@tarojs/taro';
import { abortError } from '../../shared/api/errors';
export async function returnAfterPreferencesSave(isActive: () => boolean): Promise<void> {
  if (!isActive()) throw abortError();
  try {
    await Taro.navigateBack();
  } catch {
    if (!isActive()) throw abortError();
    await Taro.redirectTo({ url: '/pages/business-settings/index' });
  }
}
