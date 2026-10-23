import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@tarojs/components', () => ({
  Button: 'button',
  ScrollView: 'scroll-view',
  Label: 'label',
  Text: 'text',
  Textarea: 'textarea',
  View: 'view',
}));
vi.mock('../src/shared/ui', () => ({ Button: 'button', Notice: 'notice' }));
import { PreferencesForm } from '../src/features/wardrobe-preferences/PreferencesForm';
import {
  emptyPreferencesDraft,
  validatePreferencesDraft,
} from '../src/features/wardrobe-preferences/draft';
import type { WardrobeOptions } from '../src/features/wardrobe/api';
type Props = { children?: ReactNode; [key: string]: unknown };
function hosts(node: ReactNode, type: string): Props[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === 'function')
      return hosts((child.type as (props: Props) => ReactNode)(child.props), type);
    return [...(child.type === type ? [child.props] : []), ...hosts(child.props.children, type)];
  });
}
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
const options: WardrobeOptions = {
  version: 'v1',
  categories: [],
  seasons: [],
  styles: [{ id: 'casual', label: '休闲' }],
  occasions: [{ id: 'office', label: '通勤' }],
  colors: ['黑色', '白色', '灰色', '蓝色', '棕色', '红色', '紫色'].map((label, index) => ({
    id: 'color' + index,
    label,
  })),
};
describe('preferences controlled interactions', () => {
  it('exposes every option in all six groups, preserves a visible conflict and clears all input', () => {
    let draft = emptyPreferencesDraft();
    const render = () =>
      PreferencesForm({
        draft,
        options,
        errors: validatePreferencesDraft(draft, options),
        onChange: (next) => {
          draft = next;
        },
      });
    const buttons = () => hosts(render(), 'button');
    const choices = (label: string) =>
      buttons().filter((button) => text(button.children).replace('✓ ', '') === label);
    expect(choices('紫色')).toHaveLength(2);
    expect(choices('休闲')).toHaveLength(2);
    expect(choices('通勤')).toHaveLength(2);
    (choices('紫色')[0].onClick as () => void)();
    expect(text(choices('紫色')[0].children)).toBe('✓ 紫色');
    (choices('紫色')[1].onClick as () => void)();
    expect(choices('紫色').every((button) => text(button.children).startsWith('✓'))).toBe(true);
    expect(
      hosts(render(), 'notice')
        .map((notice) => text(notice.children))
        .filter((value) => value.includes('颜色不能同时')),
    ).toHaveLength(2);
    expect(draft.likedColors).toEqual(['color6']);
    expect(draft.avoidedColors).toEqual(['color6']);
    (choices('紫色')[1].onClick as () => void)();
    expect(draft.likedColors).toEqual(['color6']);
    expect(draft.avoidedColors).toEqual([]);
    const notes = hosts(render(), 'textarea')[0];
    expect(notes.maxlength).toBe(500);
    expect(notes.adjustPosition).toBe(true);
    (notes.onInput as (event: { detail: { value: string } }) => void)({
      detail: { value: '  原文要求  ' },
    });
    expect(draft.comfortNotes).toBe('  原文要求  ');
    (buttons().find((button) => text(button.children) === '清除所有偏好')!.onClick as () => void)();
    expect(draft).toEqual(emptyPreferencesDraft());
  });
  it('does not change selection or text when locked for an unresolved operation', () => {
    const onChange = vi.fn();
    const tree = PreferencesForm({
      draft: emptyPreferencesDraft(),
      options,
      errors: {},
      disabled: true,
      onChange,
    });
    const button = hosts(tree, 'button')[0];
    expect(button.disabled).toBe(true);
    (button.onClick as () => void)();
    const notes = hosts(tree, 'textarea')[0];
    expect(notes.disabled).toBe(true);
    (notes.onInput as (event: { detail: { value: string } }) => void)({
      detail: { value: 'late' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
