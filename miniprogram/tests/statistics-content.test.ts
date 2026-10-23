import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@tarojs/components', () => ({
  Button: 'button',
  View: 'view',
  Text: 'text',
  ScrollView: 'scroll-view',
}));
vi.mock('../src/shared/ui', () => ({ Button: 'button' }));
import { GarmentCountRows, StatisticsContent } from '../src/features/statistics/StatisticsContent';
import type { Statistics } from '../src/features/statistics/api';
type Props = {
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: { width?: string; height?: string };
};
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<Props>(child)
        ? text(child.props.children)
        : typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : '',
    )
    .join('');
}
function nodes(node: ReactNode): { type: unknown; props: Props; label: string }[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === 'function')
      return nodes((child.type as (props: Props) => ReactNode)(child.props));
    return [
      { type: child.type, props: child.props, label: text(child.props.children) },
      ...nodes(child.props.children),
    ];
  });
}
function value(): Statistics {
  return {
    wardrobe_total: 4,
    archived_count: 0,
    category_counts: [
      { category: 'tops', count: 2 },
      { category: null, count: 2 },
    ],
    wear_record_count: 0,
    trend: {
      start_date: '2024-02-20',
      end_date: '2024-03-20',
      timezone: 'Asia/Shanghai',
      days: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(Date.parse('2024-02-20T00:00:00Z') + index * 86400000)
          .toISOString()
          .slice(0, 10),
        count: 0,
      })),
    },
    garment_counts: {
      items: Array.from({ length: 4 }, (_, index) => ({
        garment_id: String(4 - index).repeat(8) + '-1111-4111-8111-111111111111',
        name: null,
        category: null,
        status: 'wearable',
        wear_count: 0,
      })),
      next_cursor: null,
    },
  };
}
describe('statistics rendered content', () => {
  it('renders equal category counts at the same maximum width and labels actual range with an honest empty history', () => {
    const rendered = nodes(
      createElement(StatisticsContent, {
        value: value(),
        categories: [{ id: 'tops', label: '上装' }],
      }),
    );
    expect(
      rendered
        .filter((node) => node.props.className?.includes('categoryBar'))
        .map((node) => node.props.style?.width),
    ).toEqual(['100%', '100%']);
    expect(rendered.some((node) => node.type === 'text' && node.label === '未分类')).toBe(true);
    expect(rendered.some((node) => node.type === 'text' && node.label === '穿搭次数')).toBe(true);
    expect(rendered.some((node) => node.type === 'text' && node.label === '暂无已记录穿着')).toBe(
      true,
    );
    expect(
      rendered.some(
        (node) => node.type === 'text' && node.label.includes('2024-02-20 至 2024-03-20'),
      ),
    ).toBe(true);
    expect(
      rendered
        .filter((node) => node.props.className?.includes('trendBar'))
        .map((node) => node.props.style?.height),
    ).toEqual(Array(5).fill('0%'));
  });
  it('renders zero archived counts without inferring never worn and opens the real garment id', () => {
    const row = {
      garment_id: value().garment_counts.items[0].garment_id,
      name: null,
      category: null,
      status: 'archived' as const,
      wear_count: 0,
    };
    const onOpen = vi.fn();
    const rendered = nodes(createElement(GarmentCountRows, { items: [row], onOpen }));
    const button = rendered.find((node) => node.type === 'button')!;
    expect(button.label).toContain('未命名衣物');
    expect(button.label).toContain('已归档');
    expect(button.label).toContain('0 次');
    expect(button.label).not.toContain('从未');
    button.props.onClick!();
    expect(onOpen).toHaveBeenCalledWith(row.garment_id);
  });
});
