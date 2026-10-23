import { createRequire } from 'node:module';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { garmentListQueryOptions } from '../src/features/wardrobe/queries';
import type { GarmentList } from '../src/features/wardrobe/api';
import { wearListQueryOptions } from '../src/features/wear-history/queries';

vi.mock('@tarojs/taro', async (original) => ({
  ...(await original<object>()),
  useDidShow: () => {},
  useDidHide: () => {},
}));
vi.mock('@tarojs/components', () => ({
  Button: ({
    children,
    disabled,
    className,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    className?: string;
  }) => createElement('button', { disabled, className }, children),
  Image: ({ src, className }: { src: string; className?: string }) =>
    createElement('img', { src, className }),
  ScrollView: ({ children, className }: { children?: ReactNode; className?: string }) =>
    createElement('div', { className }, children),
  Text: 'span',
  View: 'div',
  Input: 'input',
  Label: 'label',
  Textarea: 'textarea',
  Picker: 'div',
}));
vi.mock('../src/features/wardrobe/Page', () => ({
  WardrobePage: ({
    children,
    footer,
    bottomNavigation,
  }: {
    children?: ReactNode;
    footer?: ReactNode;
    bottomNavigation?: ReactNode;
  }) =>
    createElement(
      'main',
      null,
      children,
      footer ? createElement('footer', null, footer) : null,
      bottomNavigation,
    ),
}));
vi.mock('../src/features/wear-history/Navigation', () => ({
  WardrobeNavigation: () => createElement('nav', null, '衣柜 穿搭 记录'),
}));
vi.mock('../src/shared/ui', () => ({
  Button: ({ children }: { children?: ReactNode }) => createElement('button', null, children),
  Field: () => createElement('input'),
  Notice: ({ children }: { children?: ReactNode }) => createElement('aside', null, children),
  StatePanel: ({ title, state }: { title: string; state: string }) =>
    createElement('section', { 'data-state': state }, title),
}));
import WardrobePage from '../src/pages/wardrobe';
import WearHistoryPage from '../src/pages/wear-history';
import OutfitsPage from '../src/pages/outfits';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (node: ReactNode) => string;
};
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('empty-page-owner', 1);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
});
function inventory(
  filters: Parameters<typeof garmentListQueryOptions>[1],
  items: GarmentList['items'] = [],
) {
  const key = garmentListQueryOptions(getAuthSession(), filters).queryKey;
  client.setQueryData(key, { pages: [{ items, next_cursor: null }], pageParams: [null] });
  return key;
}
function render(page: () => ReactNode) {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(page)));
}

describe('verified business empty states', () => {
  it('shows the first-garment page only after the unfiltered wardrobe is known empty', () => {
    inventory({ status: 'wearable' });
    expect(render(WardrobePage)).toContain('正在核对全部库存');
    inventory({});
    const html = render(WardrobePage);
    expect(html).toContain('从第一件衣物开始');
    expect(html).not.toContain('更多筛选');
    expect(html).not.toContain('<footer>');
    expect(html).toContain('<nav>衣柜 穿搭 记录</nav>');
    expect(html.match(/添加第一件衣物/g)).toHaveLength(1);
  });

  it('keeps filtering and adding available when only the selected status is empty', () => {
    inventory({ status: 'wearable' });
    inventory({}, [
      {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'unavailable',
        version: 1,
        created_at: '2026-10-23T00:00:00Z',
        updated_at: '2026-10-23T00:00:00Z',
      },
    ]);
    const html = render(WardrobePage);
    expect(html).toContain('没有符合条件的衣物');
    expect(html).toContain('清除筛选');
    expect(html).toContain('更多筛选');
    expect(html).toContain('<footer>');
    expect(html).not.toContain('从第一件衣物开始');
  });

  it('does not turn an errored inventory check into the first-use screen', () => {
    inventory({ status: 'wearable' });
    const key = inventory({});
    client
      .getQueryCache()
      .find({ queryKey: key, exact: true })!
      .setState({ status: 'error', error: new Error('offline') });
    const html = render(WardrobePage);
    expect(html).toContain('全部库存暂时无法读取');
    expect(html).not.toContain('从第一件衣物开始');
  });

  it('shows one recording action for a successful empty history and retains statistics access', () => {
    client.setQueryData(wearListQueryOptions(getAuthSession(), {}).queryKey, {
      pages: [{ items: [], next_cursor: null }],
      pageParams: [null],
    });
    const html = render(WearHistoryPage);
    expect(html).toContain('记下你的第一套穿搭');
    expect(html.match(/记录一次穿搭/g)).toHaveLength(1);
    expect(html).toContain('衣柜统计');
    expect(html).not.toContain('<footer>');
    expect(html).not.toContain('补录穿着');
  });

  it('guides an empty wardrobe to adding clothes without generating a recommendation', () => {
    inventory({});
    const html = render(OutfitsPage);
    expect(html).toContain('穿搭灵感，从衣柜开始');
    expect(html).toContain('去添加衣物');
    expect(html).not.toContain('生成穿搭');
    expect(html).not.toContain('记录今天穿着');
    expect(html).not.toContain('<footer>');
    expect(Taro.request).not.toHaveBeenCalled();
  });

  it('keeps loading and errors separate from empty history', () => {
    expect(render(WearHistoryPage)).toContain('正在读取穿着记录');
    const key = wearListQueryOptions(getAuthSession(), {}).queryKey;
    client.setQueryData(key, { pages: [{ items: [], next_cursor: null }], pageParams: [null] });
    client
      .getQueryCache()
      .find({ queryKey: key, exact: true })!
      .setState({ status: 'error', error: new Error('offline') });
    const html = render(WearHistoryPage);
    expect(html).toContain('记录加载失败');
    expect(html).not.toContain('记下你的第一套穿搭');
  });
});
