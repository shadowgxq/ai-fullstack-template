import Taro from '@tarojs/taro';
import { demoUrl, type DemoGroup } from './catalog';
import { errorMessage } from '../../shared/api/errors';

export async function navigateToDemo(group: DemoGroup, section?: string) {
  try {
    await Taro.navigateTo({ url: demoUrl(group, section) });
  } catch (error) {
    await Taro.showToast({ title: errorMessage(error), icon: 'none' });
  }
}
export async function openCatalog(query = '') {
  try {
    // 由目标页 onShow 读取一次性入口参数，辅助示例保持普通页面导航。
    catalogEntryQuery = query;
    await Taro.navigateTo({ url: '/pages/components/index' });
  } catch (error) {
    catalogEntryQuery = null;
    await Taro.showToast({ title: errorMessage(error), icon: 'none' });
  }
}
let catalogEntryQuery: string | null = null;
export function consumeCatalogQuery() {
  const query = catalogEntryQuery;
  catalogEntryQuery = null;
  return query;
}
export function showReferenceEntry(title: string) {
  void Taro.showModal({
    title,
    content: '此入口为组件库界面示例，暂未接入相关服务。',
    showCancel: false,
  });
}
