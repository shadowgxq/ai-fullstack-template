export const swipeActionWidth = 128;
export interface ExampleRow {
  id: string;
  title: string;
  detail: string;
  saved: boolean;
}
export const swipeExamples: ExampleRow[] = [
  { id: 'note', title: '设计交互笔记', detail: '今天 09:41 · 交互细节与使用建议', saved: false },
  {
    id: 'components',
    title: '常用组件清单',
    detail: '昨天 16:20 · 表单、按钮与信息展示',
    saved: true,
  },
  { id: 'native', title: '原生体验指南', detail: '10-18 14:30 · 导航与手势体验', saved: false },
];
export const reorderExamples = [
  { id: 'button', title: '按钮操作', detail: '主要、次要和图标按钮' },
  { id: 'input', title: '文本输入', detail: '输入、搜索与校验反馈' },
  { id: 'card', title: '内容卡片', detail: '头像、正文和操作栏' },
  { id: 'feedback', title: '状态反馈', detail: '加载、结果与空状态' },
];
export type ReorderRow = (typeof reorderExamples)[number];
export function moveItem<T extends { id: string }>(
  rows: readonly T[],
  id: string,
  to: number,
): T[] {
  const from = rows.findIndex((row) => row.id === id);
  if (from < 0 || !Number.isInteger(to) || to < 0 || to >= rows.length || from === to)
    return [...rows];
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}
export interface DragMetric {
  id: string;
  top: number;
  height: number;
}
export function parseDragMetrics(raw: unknown, ids: readonly string[]): DragMetric[] | null {
  if (!Array.isArray(raw) || raw.length !== ids.length) return null;
  const metrics: DragMetric[] = [];
  for (const [index, value] of raw.entries()) {
    if (
      !value ||
      typeof value !== 'object' ||
      value.id !== `sort-${ids[index]}` ||
      typeof value.top !== 'number' ||
      !Number.isFinite(value.top) ||
      typeof value.height !== 'number' ||
      !Number.isFinite(value.height) ||
      value.height <= 0
    )
      return null;
    if (index && value.top < metrics[index - 1].top + metrics[index - 1].height) return null;
    metrics.push({ id: ids[index], top: value.top, height: value.height });
  }
  return metrics;
}
export function dragLayout(order: readonly { id: string }[], metrics: readonly DragMetric[]) {
  const gap =
    metrics.length > 1 ? Math.max(0, metrics[1].top - metrics[0].top - metrics[0].height) : 0;
  let top = metrics[0]?.top ?? 0;
  return order.map((row) => {
    const measured = metrics.find((metric) => metric.id === row.id);
    if (!measured) throw new Error('排序项目与测量结果不一致');
    const position = { id: row.id, top, height: measured.height };
    top += measured.height + gap;
    return position;
  });
}
export function dragPosition<T extends { id: string }>(
  order: readonly T[],
  id: string,
  desiredTop: number,
  metrics: readonly DragMetric[],
) {
  const layout = dragLayout(order, metrics);
  const active = layout.find((row) => row.id === id);
  if (!active || !layout.length) return null;
  const bottom = layout[layout.length - 1].top + layout[layout.length - 1].height;
  const top = Math.max(layout[0].top, Math.min(bottom - active.height, desiredTop));
  const center = top + active.height / 2;
  let target = 0;
  // 本次触摸固定使用起始槽位判定目标，避免预览换位后边界变化导致来回跳动。
  metrics.forEach((row, index) => {
    if (
      Math.abs(center - (row.top + row.height / 2)) <
      Math.abs(center - (metrics[target].top + metrics[target].height / 2))
    )
      target = index;
  });
  const rows = moveItem(order, id, target);
  const slot = dragLayout(rows, metrics).find((row) => row.id === id)!;
  return { rows, top, offset: top - slot.top };
}
