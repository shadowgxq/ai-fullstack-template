import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore, useLoginModal } from '../../../auth';
import { i18n } from '../../../../shared/i18n';
import { SaveReportError } from '../../model/save-report.gateway';
import { SaveReportToHistory } from './SaveReportToHistory';

const bindMock = vi.fn();
let bindError: unknown = null;

vi.mock('../../model/save-report.mutations', () => ({
  useBindTaskToAccount: () => ({
    mutate: bindMock,
    isPending: false,
    get error() {
      return bindError;
    },
  }),
}));

function renderAt(path = '/research/task-1/result') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/research/:taskId/result"
            element={<SaveReportToHistory taskId="task-1" />}
          />
          <Route path="/login" element={<div>Login landing</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('SaveReportToHistory', () => {
  beforeEach(() => {
    bindMock.mockReset();
    bindError = null;
    useAuthStore.getState().clear();
    useLoginModal.getState().closeLogin();
  });

  afterEach(() => {
    cleanup();
  });

  it('未登录时点击就地打开登录弹窗，不跳路由也不发起绑定', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Save report' }));

    expect(bindMock).not.toHaveBeenCalled();
    expect(useLoginModal.getState().open).toBe(true);
    expect(screen.queryByText('Login landing')).not.toBeInTheDocument();
  });

  it('登录成功后自动补做这次保存', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Save report' }));
    expect(bindMock).not.toHaveBeenCalled();

    // 模拟弹窗登录成功：LoginModal 会取出 pendingAction 执行
    const { pendingAction } = useLoginModal.getState();
    pendingAction?.();

    expect(bindMock).toHaveBeenCalledTimes(1);
    expect(bindMock.mock.calls[0][0]).toBe('task-1');
  });

  it('弹窗被取消时丢弃待办，不会在下次登录时被动绑定', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Save report' }));

    useLoginModal.getState().closeLogin();

    expect(useLoginModal.getState().pendingAction).toBeNull();
    expect(bindMock).not.toHaveBeenCalled();
  });

  it('已登录时点击只绑定当前任务，不触发任何研究创建', async () => {
    useAuthStore.getState().setSession('jwt', { userId: '1', email: 'a@example.com' });
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Save report' }));

    expect(bindMock).toHaveBeenCalledTimes(1);
    expect(bindMock.mock.calls[0][0]).toBe('task-1');
  });

  it('绑定成功后按钮变为已保存且不可再点', async () => {
    useAuthStore.getState().setSession('jwt', { userId: '1', email: 'a@example.com' });
    bindMock.mockImplementation((_taskId: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Save report' }));

    const saved = await screen.findByRole('button', { name: /Saved/ });
    expect(saved).toBeDisabled();

    await userEvent.click(saved);
    expect(bindMock).toHaveBeenCalledTimes(1);
  });

  it('服务端报已绑定时同样落到已保存终态，不显示为通用失败', async () => {
    useAuthStore.getState().setSession('jwt', { userId: '1', email: 'a@example.com' });
    bindMock.mockImplementation(
      (_taskId: string, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new SaveReportError('ALREADY_BOUND'));
      },
    );
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Save report' }));

    expect(await screen.findByRole('button', { name: /Saved/ })).toBeDisabled();
  });

  it('绑定失败时展示对应错误码的文案', async () => {
    useAuthStore.getState().setSession('jwt', { userId: '1', email: 'a@example.com' });
    bindError = new SaveReportError('NOT_FOUND');
    renderAt();

    expect(screen.getByRole('alert')).toHaveTextContent('This research report no longer exists.');
  });
});
