import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@tarojs/components', () => ({
  Button: 'button',
  View: 'view',
  Text: 'text',
  Image: 'image',
}));
vi.mock('../src/shared/ui', () => ({
  Button: 'button',
  Notice: 'notice',
  StatePanel: 'state-panel',
}));
vi.mock('../src/features/wardrobe/PrivatePhoto', () => ({ PrivatePhoto: 'private-photo' }));
vi.mock('../src/shared/theme/preferences', () => ({ useTheme: () => 'light' }));
import { OutfitActions, OutfitResult } from '../src/features/outfits/OutfitView';
import { ReplacementChoices } from '../src/features/outfits/ReplacementSheet';
import { WardrobeNavigation } from '../src/features/wear-history/Navigation';
import { type OutfitState } from '../src/features/outfits/session';
import { garmentA, garmentB, selection, view } from './outfit-fixtures';
import Taro from './taro-mock';
type Props = {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  mediaId?: string | null;
};
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) =>
      isValidElement<Props>(c)
        ? text(c.props.children)
        : typeof c === 'string' || typeof c === 'number'
          ? String(c)
          : '',
    )
    .join('');
}
function nodes(node: ReactNode): { type: unknown; props: Props; label: string }[] {
  return Children.toArray(node).flatMap((c) => {
    if (!isValidElement<Props>(c)) return [];
    if (typeof c.type === 'function')
      return nodes((c.type as (props: Props) => ReactNode)(c.props));
    return [
      { type: c.type, props: c.props, label: text(c.props.children) },
      ...nodes(c.props.children),
    ];
  });
}
const state = (patch: Partial<OutfitState> = {}): OutfitState => ({
  view: view(),
  submitted: { scene: 'any', weather_context_id: null },
  selectedIds: [garmentA.id],
  garments: [garmentA],
  selection: selection(),
  checking: false,
  selectionError: null,
  creating: false,
  uncertain: false,
  cancelling: false,
  refreshing: false,
  error: null,
  ...patch,
});
describe('outfit visible states and actions', () => {
  it('shows cancel and blocks confirmation while generation/cancellation is pending', () => {
    const cancel = vi.fn();
    let s = state({
      view: view({ status: 'generating', outcome: null, result: null }),
      selection: null,
    });
    let render = nodes(
      createElement(OutfitActions, {
        state: s,
        onGenerate: vi.fn(),
        onCancel: cancel,
        onConfirm: vi.fn(),
      }),
    );
    render.find((n) => n.label === '取消生成')!.props.onClick!();
    expect(cancel).toHaveBeenCalledOnce();
    expect(render.find((n) => n.label === '记录今天穿着')!.props.disabled).toBe(true);
    s = { ...s, cancelling: true };
    render = nodes(
      createElement(OutfitActions, {
        state: s,
        onGenerate: vi.fn(),
        onCancel: cancel,
        onConfirm: vi.fn(),
      }),
    );
    expect(render.find((n) => n.label === '取消中')!.props.loading).toBe(true);
  });
  it('hides all old reasons during validation and exposes retry while preserving selected photo identity', () => {
    const render = (s: OutfitState) =>
      nodes(
        createElement(OutfitResult, {
          state: s,
          onReplace: vi.fn(),
          onRetry: vi.fn(),
          onRetrySelection: vi.fn(),
          onAdd: vi.fn(),
          onPreferences: vi.fn(),
        }),
      );
    expect(render(state()).some((n) => n.label === '已核验当前选择')).toBe(true);
    const checking = render(state({ selection: null, checking: true }));
    expect(checking.some((n) => n.label === '已核验当前选择')).toBe(false);
    expect(checking.some((n) => n.type === 'private-photo' && n.props.mediaId === null)).toBe(true);
    const failed = render(state({ selection: null, selectionError: '校验失败' }));
    expect(failed.some((n) => n.label === '重试校验当前组合')).toBe(true);
    expect(failed.some((n) => n.label === '为什么推荐这套？')).toBe(false);
  });
  it('keeps no-inventory/no-candidate normal states distinct and does not embed sample garments', () => {
    for (const outcome of ['no_inventory', 'no_candidates'] as const) {
      const render = nodes(
        createElement(OutfitResult, {
          state: state({ view: view({ outcome, result: null }), selection: null, garments: [] }),
          onReplace: vi.fn(),
          onRetry: vi.fn(),
          onRetrySelection: vi.fn(),
          onAdd: vi.fn(),
          onPreferences: vi.fn(),
        }),
      );
      expect(
        render.some(
          (n) =>
            n.label ===
            (outcome === 'no_inventory' ? '穿搭灵感，从衣柜开始' : '暂时没有合适的推荐单品'),
        ),
      ).toBe(true);
      expect(
        render.some(
          (n) =>
            n.type === 'button' &&
            n.label === (outcome === 'no_inventory' ? '去添加衣物' : '管理衣柜'),
        ),
      ).toBe(true);
      expect(render.some((n) => n.label === '调整穿搭偏好')).toBe(outcome === 'no_candidates');
      expect(render.some((n) => n.type === 'private-photo')).toBe(false);
    }
  });
  it('applies candidate click immediately and retains current selection label', () => {
    const choose = vi.fn();
    const render = nodes(
      createElement(ReplacementChoices, {
        items: [garmentA, garmentB],
        currentId: garmentA.id,
        onChoose: choose,
      }),
    );
    expect(render.some((n) => n.label === '✓ 当前搭配')).toBe(true);
    render.find((n) => n.type === 'button' && n.label.includes('外套'))!.props.onClick!();
    expect(choose).toHaveBeenCalledWith(garmentB);
    expect(render.some((n) => n.type === 'button' && n.label === '确认')).toBe(false);
  });
  it('connects all three main destinations and keeps the active destination stable', () => {
    const render = nodes(createElement(WardrobeNavigation, { active: 'outfits' }));
    expect(render.filter((n) => n.type === 'button').map((n) => n.label)).toEqual([
      '衣柜',
      '穿搭',
      '记录',
    ]);
    const before = Taro.redirectTo.mock.calls.length;
    render.find((n) => n.type === 'button' && n.label === '穿搭')!.props.onClick!();
    expect(Taro.redirectTo.mock.calls).toHaveLength(before);
    render.find((n) => n.type === 'button' && n.label === '记录')!.props.onClick!();
    expect(Taro.redirectTo).toHaveBeenLastCalledWith({ url: '/pages/wear-history/index' });
  });
});
