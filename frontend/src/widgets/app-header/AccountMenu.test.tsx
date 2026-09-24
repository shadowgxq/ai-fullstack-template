import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '@/shared/i18n';
import { AccountMenu } from './AccountMenu';

/**
 * 特征测试：锁住换 UI 体系之前的行为。这些断言描述的是既有实现，
 * 组件底层由 Radix Popover 换成 shadcn dropdown-menu 之后必须依然成立。
 */
function renderMenu(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('AccountMenu', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('保留当前后端的完整用户名身份', async () => {
    renderMenu(<AccountMenu accountName="alice_9f2c" onLogout={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'alice_9f2c' }));

    expect(screen.getAllByText('alice_9f2c').length).toBeGreaterThan(0);
    expect(screen.queryByText('Change password')).not.toBeInTheDocument();
  });

  it('保留不匹配后缀规则的用户名', async () => {
    renderMenu(<AccountMenu accountName="alice_hello" onLogout={() => {}} />);

    expect(screen.getByRole('button', { name: 'alice_hello' })).toBeInTheDocument();
  });

  it('isAdmin 时展示管理员标记', async () => {
    renderMenu(<AccountMenu accountName="bob" isAdmin onLogout={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'bob' }));

    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  it('点击登出触发回调', async () => {
    const onLogout = vi.fn();
    renderMenu(<AccountMenu accountName="bob" onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: 'bob' }));
    await userEvent.click(screen.getByText('Log out'));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('logoutPending 时登出入口不可用', async () => {
    const onLogout = vi.fn();
    renderMenu(<AccountMenu accountName="bob" onLogout={onLogout} logoutPending />);

    await userEvent.click(screen.getByRole('button', { name: 'bob' }));
    await userEvent.click(screen.getByText('Log out'));

    expect(onLogout).not.toHaveBeenCalled();
  });
});
