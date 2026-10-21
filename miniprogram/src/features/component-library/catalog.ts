export type DemoGroup = 'controls' | 'content' | 'feedback' | 'overlays' | 'gestures';
export type CatalogFilter = '全部' | '基础组件' | '业务组件' | '展示组件' | '反馈组件';

export const catalogFilters: CatalogFilter[] = [
  '全部',
  '基础组件',
  '业务组件',
  '展示组件',
  '反馈组件',
];
export const componentCategories: {
  id: string;
  title: string;
  description: string;
  count: number;
  filter: CatalogFilter;
  group: DemoGroup;
  section?: string;
  keywords: string;
}[] = [
  {
    id: 'form',
    title: '表单输入',
    description: '输入框、选择器、开关等',
    count: 14,
    filter: '基础组件',
    group: 'controls',
    section: 'input',
    keywords: 'input field search switch checkbox radio picker 表单 名称 搜索 城市 开关 复选 单选',
  },
  {
    id: 'buttons',
    title: '按钮类',
    description: '主要、次要、文字按钮',
    count: 10,
    filter: '基础组件',
    group: 'controls',
    section: 'buttons',
    keywords: 'button 按钮 保存 更多',
  },
  {
    id: 'content',
    title: '数据展示',
    description: '列表、卡片、标签等',
    count: 16,
    filter: '展示组件',
    group: 'content',
    keywords: 'card cell badge feed avatar 卡片 列表 内容 头像 标签',
  },
  {
    id: 'feedback',
    title: '反馈与提示',
    description: '加载、提示、操作结果等',
    count: 8,
    filter: '反馈组件',
    group: 'feedback',
    keywords: 'notice loading skeleton empty error progress toast 加载 骨架 错误 空状态 重试',
  },
  {
    id: 'navigation',
    title: '导航类',
    description: '标签栏、导航栏、步骤条等',
    count: 9,
    filter: '基础组件',
    group: 'controls',
    section: 'navigation',
    keywords: 'tabs segmented 导航 分段 标签栏',
  },
  {
    id: 'overlays',
    title: '弹窗与弹层',
    description: '对话框、动作面板、底部弹层',
    count: 3,
    filter: '反馈组件',
    group: 'overlays',
    keywords: 'dialog modal action sheet bottom sheet 弹窗 弹层 对话框 筛选 遮罩',
  },
  {
    id: 'gestures',
    title: '手势交互',
    description: '列表侧滑、拖动排序',
    count: 2,
    filter: '基础组件',
    group: 'gestures',
    keywords: 'swipe drag reorder 手势 侧滑 滑动 拖动 拖拽 排序 收藏 删除',
  },
];

export function filterCategories(query: string, filter: CatalogFilter) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return componentCategories.filter(
    (category) =>
      (filter === '全部' || category.filter === filter) &&
      words.every((word) =>
        `${category.title} ${category.description} ${category.keywords}`
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
}

export const demoTitles: Record<DemoGroup, string> = {
  controls: '基础控件',
  content: '内容与列表',
  feedback: '状态与反馈',
  overlays: '弹窗与弹层',
  gestures: '手势交互',
};
export function parseDemoGroup(value?: string): DemoGroup | null {
  return value && Object.prototype.hasOwnProperty.call(demoTitles, value)
    ? (value as DemoGroup)
    : null;
}
export function demoUrl(group: DemoGroup, section?: string) {
  return `/pages/demo/index?group=${group}${section ? `&section=${encodeURIComponent(section)}` : ''}`;
}
