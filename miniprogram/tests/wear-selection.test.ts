import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@tarojs/components', () => ({
  Button: 'button',
  View: 'view',
  Text: 'text',
  ScrollView: 'scroll-view',
  Picker: 'picker',
}));
vi.mock('../src/shared/ui', () => ({
  Button: 'button',
  Notice: 'notice',
  StatePanel: 'state-panel',
}));
vi.mock('../src/features/wardrobe/PrivatePhoto', () => ({ PrivatePhoto: 'private-photo' }));
vi.mock('../src/features/wardrobe/Icon', () => ({ WardrobeIcon: 'icon' }));
import { GarmentSelectionView } from '../src/features/wear-history/GarmentPicker';
import { WearForm } from '../src/features/wear-history/WearForm';
import { toggleSelection } from '../src/features/wardrobe/draft';
import { shanghaiToday } from '../src/features/wear-history/date';
import type { Garment } from '../src/features/wardrobe/api';

type Props = {
  children?: ReactNode;
  onClick?: () => void;
  onChange?: (event: { detail: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  end?: string;
  mode?: string;
  value?: string;
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
const id = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const garment: Garment = {
  id,
  name: '衬衫',
  category: null,
  color: null,
  photo_media_id: null,
  season: [],
  occasion: [],
  tags: [],
  notes: null,
  status: 'archived',
  version: 1,
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2020-01-01T00:00:00Z',
};

describe('wear selection and date component events', () => {
  it('keeps temporary toggles separate, cancels without application and completes cross-page selections once', () => {
    const original = [id];
    let temporary = [...original];
    const applied = vi.fn();
    const cancelled = vi.fn();
    let items = [garment, { ...garment, id: second, name: '长裤', status: 'unavailable' as const }];
    const view = () =>
      nodes(
        createElement(GarmentSelectionView, {
          items,
          selectedIds: temporary,
          categories: [],
          category: '',
          onCategory: vi.fn(),
          pending: false,
          error: null,
          directoryError: null,
          onRetryDirectory: vi.fn(),
          onRetry: vi.fn(),
          hasNext: false,
          loadingMore: false,
          onMore: vi.fn(),
          onToggle: (value) => {
            temporary = toggleSelection(temporary, value);
          },
          onApply: applied,
          onCancel: cancelled,
        }),
      );
    const click = (label: string) => {
      const button = view().find((node) => node.type === 'button' && node.label === label);
      expect(button).toBeDefined();
      button!.props.onClick!();
    };
    click('长裤');
    expect(temporary).toEqual([id, second]);
    expect(original).toEqual([id]);
    expect(applied).not.toHaveBeenCalled();
    click('取消');
    expect(cancelled).toHaveBeenCalledOnce();
    expect(applied).not.toHaveBeenCalled();
    temporary = [...original];
    click('长裤');
    // 筛选/翻页后不可见的原选中项仍保留，完成提交整个临时集合。
    items = [items[1]];
    click('完成选择（2）');
    expect(applied).toHaveBeenCalledWith([id, second]);
    expect(original).toEqual([id]);
    temporary = [];
    expect(
      view().find((node) => node.label === '完成选择（0）' && node.type === 'button')?.props
        .disabled,
    ).toBe(true);
  });
  it('uses a labelled native date picker, applies its change and preserves garment selection', () => {
    const draft = { wearDate: '2020-01-01', garmentIds: [id] };
    const changed = vi.fn();
    const rendered = nodes(
      createElement(WearForm, { draft, onChange: changed, onAdjust: vi.fn(), children: null }),
    );
    expect(rendered.some((node) => node.type === 'text' && node.label === '穿着日期')).toBe(true);
    const picker = rendered.find((node) => node.type === 'picker')!;
    expect(picker.props.mode).toBe('date');
    expect(picker.props.end).toBe(shanghaiToday());
    expect(changed).not.toHaveBeenCalled();
    picker.props.onChange!({ detail: { value: '2020-01-02' } });
    expect(changed).toHaveBeenCalledWith({ wearDate: '2020-01-02', garmentIds: [id] });
    expect(draft.wearDate).toBe('2020-01-01');
  });
});
