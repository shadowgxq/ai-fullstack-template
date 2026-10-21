import { beforeEach, expect, it, vi } from 'vitest';
import Taro from '@tarojs/taro';
import {
  demoUrl,
  filterCategories,
  parseDemoGroup,
} from '../src/features/component-library/catalog';
import {
  consumeCatalogQuery,
  navigateToDemo,
  openCatalog,
} from '../src/features/component-library/navigation';
import { readTouchPoint } from '../src/features/component-library/gestures';

beforeEach(() => {
  consumeCatalogQuery();
  vi.mocked(Taro.switchTab).mockResolvedValue({ errMsg: 'ok' });
  vi.mocked(Taro.navigateTo).mockResolvedValue({ errMsg: 'ok' });
});
it('searches component names and functions while respecting the selected category', () => {
  expect(filterCategories('INPUT', '全部').map((v) => v.id)).toEqual(['form']);
  expect(filterCategories('列表 卡片', '展示组件').map((v) => v.id)).toEqual(['content']);
  expect(filterCategories('  ', '全部')).toHaveLength(7);
  expect(filterCategories('按钮', '反馈组件')).toEqual([]);
  expect(filterCategories('', '业务组件')).toEqual([]);
});
it('keeps home search parameters out of the native switchTab URL and consumes them once', async () => {
  await openCatalog('输入框');
  expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/components/index' });
  expect(consumeCatalogQuery()).toBe('输入框');
  expect(consumeCatalogQuery()).toBeNull();
});
it('publishes search before switchTab can trigger the target page onShow', async () => {
  let received: string | null = null;
  vi.mocked(Taro.switchTab).mockImplementationOnce(async () => {
    received = consumeCatalogQuery();
    return { errMsg: 'ok' };
  });
  await openCatalog('switch');
  expect(received).toBe('switch');
});
it('clears failed tab navigation parameters and shows a recoverable error', async () => {
  vi.mocked(Taro.switchTab).mockRejectedValueOnce(new Error('navigation failed'));
  await openCatalog('按钮');
  expect(consumeCatalogQuery()).toBeNull();
  expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
});
it('uses a registered secondary route with a native return stack for all demo groups', async () => {
  for (const group of ['controls', 'content', 'feedback', 'overlays', 'gestures'] as const) {
    expect(parseDemoGroup(group)).toBe(group);
    await navigateToDemo(group, 'input');
    expect(Taro.navigateTo).toHaveBeenLastCalledWith({ url: demoUrl(group, 'input') });
  }
  expect(parseDemoGroup('constructor')).toBeNull();
  expect(parseDemoGroup('missing')).toBeNull();
});
it('rejects malformed host touch data instead of applying a gesture with unknown coordinates', () => {
  expect(readTouchPoint({ touches: [{ clientX: 3, clientY: 8 }] }, 'touches')).toEqual({
    clientX: 3,
    clientY: 8,
  });
  expect(
    readTouchPoint({ changedTouches: [{ clientX: 0, clientY: 8 }] }, 'changedTouches'),
  ).toEqual({ clientX: 0, clientY: 8 });
  for (const value of [
    null,
    {},
    { touches: [] },
    { touches: [{ clientX: NaN, clientY: 3 }] },
    { touches: [{ clientX: '1', clientY: 3 }] },
  ])
    expect(readTouchPoint(value, 'touches')).toBeNull();
});

it('lists overlay and gesture demos as searchable component category items', () => {
  expect(filterCategories('弹窗', '反馈组件').map((v) => v.id)).toEqual(['overlays']);
  expect(filterCategories('拖动', '基础组件').map((v) => v.id)).toEqual(['gestures']);
  expect(filterCategories('侧滑', '全部').map((v) => v.group)).toEqual(['gestures']);
});
