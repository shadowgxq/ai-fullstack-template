import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/shared/i18n';
import { SettingsMenu } from './SettingsMenu';

/**
 * 特征测试：锁住换 UI 体系之前的行为。主题开关的 role=switch 与
 * aria-checked、语言项的 aria-pressed 都是无障碍语义，重写后必须保留。
 */
function renderMenu(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <I18nextProvider i18n={i18n}>
        <SettingsMenu />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('SettingsMenu', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('暴露 role=switch 的主题开关并可切换 aria-checked', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const before = screen.getByRole('switch').getAttribute('aria-checked');
    await userEvent.click(screen.getByRole('switch'));

    expect(screen.getByRole('switch').getAttribute('aria-checked')).not.toBe(before);
  });

  it('列出可选语言并用 aria-pressed 标记当前项', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const pressed = screen
      .getAllByRole('group', { name: 'Language' })
      .flatMap((group) => within(group).getAllByRole('button'))
      .filter((element) => element.getAttribute('aria-pressed') === 'true');

    expect(pressed).toHaveLength(1);
  });

  it('点击另一种语言会切换当前项', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const options = within(screen.getByRole('group', { name: 'Language' }))
      .getAllByRole('button')
      .filter((element) => element.hasAttribute('aria-pressed'));
    const inactive = options.find((element) => element.getAttribute('aria-pressed') === 'false');

    expect(inactive).toBeDefined();
    await userEvent.click(inactive!);

    expect(inactive!.getAttribute('aria-pressed')).toBe('true');
  });

  it('不重复提供公共基础与主题页面入口', async () => {
    renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
  it('允许 Tab 经过语言选项和主题开关，Escape 关闭后返回触发按钮', async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Settings' });
    await user.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Settings' });
    const options = within(within(panel).getByRole('group', { name: 'Language' })).getAllByRole(
      'button',
    );
    await waitFor(() => expect(options[0]).toHaveFocus());
    for (const option of options.slice(1)) {
      await user.tab();
      expect(option).toHaveFocus();
    }
    await user.tab();
    const toggle = within(panel).getByRole('switch');
    expect(toggle).toHaveFocus();
    const checked = toggle.getAttribute('aria-checked');
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).not.toBe(checked);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
