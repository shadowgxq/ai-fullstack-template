import { createElement, isValidElement, Children, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// 测试业务组件的受控交互，原生宿主只保留节点与事件，不启动 Taro DOM。
vi.mock('@tarojs/components', () => ({
  Button: 'button',
  Image: 'image',
  ScrollView: 'scroll-view',
  Text: 'text',
  View: 'view',
}));
vi.mock('../src/shared/ui', () => ({ Button: 'button' }));
vi.mock('../src/features/wardrobe/Icon', () => ({ WardrobeIcon: 'icon' }));
import { ColorChoices, ChoiceSheet } from '../src/features/wardrobe/controls';

type ButtonNode = { label: string; className?: string; click: () => void };
type HostProps = {
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
};
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (isValidElement<{ children?: ReactNode }>(child)) return text(child.props.children);
      return typeof child === 'string' || typeof child === 'number' ? String(child) : '';
    })
    .join('');
}
function buttons(node: ReactNode): ButtonNode[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<HostProps>(child)) return [];
    if (typeof child.type === 'function') {
      const render = child.type as (props: HostProps) => ReactNode;
      return buttons(render(child.props));
    }
    if (child.type === 'button')
      return [
        {
          label: child.props.ariaLabel ?? text(child.props.children),
          className: child.props.className,
          click: child.props.onClick ?? (() => undefined),
        },
      ];
    return buttons(child.props.children);
  });
}
const colors = ['黑色', '白色', '灰色', '米色', '棕色', '红色', '紫色'].map((label, index) => ({
  id: ['black', 'white', 'gray', 'beige', 'brown', 'red', 'purple'][index],
  label,
}));

describe('wardrobe single-choice components', () => {
  it('shows the seventh color after choosing, marks it on reopen, preserves cancel and clears it', () => {
    let value: string | null = null;
    let open = false;
    const main = () =>
      buttons(
        createElement(ColorChoices, {
          options: colors,
          value,
          onChange: (next) => {
            value = next;
          },
          onMore: () => {
            open = true;
          },
        }),
      );
    const sheet = () =>
      open
        ? buttons(
            createElement(ChoiceSheet, {
              title: '选择主要颜色',
              kind: 'color',
              options: colors,
              value,
              onChoose: (next) => {
                value = next;
                open = false;
              },
              onClose: () => {
                open = false;
              },
            }),
          )
        : [];
    const click = (nodes: ButtonNode[], label: string) => {
      const button = nodes.find((node) => node.label === label);
      expect(button, 'visible button: ' + label).toBeDefined();
      button!.click();
    };
    expect(main().some((node) => node.label.includes('紫色'))).toBe(false);
    click(main(), '更多颜色');
    click(sheet(), '紫色');
    expect(value).toBe('purple');
    expect(open).toBe(false);
    expect(main().find((node) => node.label === '✓ 紫色')?.className).toContain('selected');
    click(main(), '更多颜色');
    expect(sheet().find((node) => node.label === '✓ 紫色')?.className).toContain('selected');
    click(sheet(), '关闭');
    expect(value).toBe('purple');
    expect(main().some((node) => node.label === '✓ 紫色')).toBe(true);
    click(main(), '更多颜色');
    click(sheet(), '清除颜色');
    expect(value).toBeNull();
    expect(open).toBe(false);
    expect(main().some((node) => node.label.includes('紫色'))).toBe(false);
    click(main(), '更多颜色');
    expect(sheet().some((node) => node.label.startsWith('✓'))).toBe(false);
  });
  it('marks the current category and cancellation does not choose a new value', () => {
    const choose = vi.fn();
    const close = vi.fn();
    const nodes = buttons(
      createElement(ChoiceSheet, {
        title: '选择衣物分类',
        options: [{ id: 'tops', label: '上装' }],
        value: 'tops',
        onChoose: choose,
        onClose: close,
      }),
    );
    expect(nodes.find((node) => node.label === '✓ 上装')?.className).toContain('selected');
    nodes.find((node) => node.label === '关闭')!.click();
    expect(close).toHaveBeenCalledOnce();
    expect(choose).not.toHaveBeenCalled();
  });
});
