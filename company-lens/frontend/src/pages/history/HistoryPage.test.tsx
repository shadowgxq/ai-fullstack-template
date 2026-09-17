import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../features/auth';
import type { ResearchHistoryPage, ResearchHistoryRecord } from '../../features/research-history';
import { i18n } from '../../shared/i18n';
import { HistoryPage } from './HistoryPage';

const listHistoryMock = vi.fn();
const deleteHistoryRecordMock = vi.fn();

// mock 网关边界：跑真实 useResearchHistoryList/useDeleteResearchHistoryRecord + 真实
// QueryClient，只替换请求层，这样「删除后列表更新」这条断言走的是真实的缓存 patch 逻辑。
vi.mock('../../features/research-history/model/research-history.source', () => ({
  researchHistoryGateway: {
    listHistory: (...args: unknown[]) => listHistoryMock(...args),
    deleteHistoryRecord: (...args: unknown[]) => deleteHistoryRecordMock(...args),
  },
}));

const NVIDIA_RECORD: ResearchHistoryRecord = {
  taskId: 'task-nvidia',
  query: '英伟达',
  objectType: 'company',
  objectName: 'NVIDIA Corporation',
  companyName: 'NVIDIA',
  stockCode: 'NVDA',
  market: 'US',
  status: 'COMPLETED',
  conclusion: { decision: 'BUY', confidence: 'HIGH' },
  createdAt: '2026-07-24T09:00:00Z',
};

const TENCENT_RECORD: ResearchHistoryRecord = {
  taskId: 'task-tencent',
  query: '微信',
  objectType: 'product',
  objectName: '微信',
  companyName: 'Tencent',
  stockCode: '00700',
  market: 'HK',
  status: 'FAILED',
  createdAt: '2026-07-15T09:00:00Z',
};

const REPORT_RETRY_RECORD: ResearchHistoryRecord = {
  taskId: 'task-report-retry',
  query: 'Report retry',
  objectType: 'company',
  objectName: 'Report retry company',
  companyName: 'Report Retry Co',
  status: 'FAILED',
  finalResultAvailable: false,
  synthesisFailed: true,
  capabilities: [
    { name: 'company_profile', status: 'SUCCEEDED' },
    { name: 'business_analysis', status: 'SUCCEEDED' },
    { name: 'financial_analysis', status: 'SUCCEEDED' },
  ],
  createdAt: '2026-07-14T09:00:00Z',
};

const BYD_PARTIAL_RECORD: ResearchHistoryRecord = {
  ...TENCENT_RECORD,
  taskId: 'task-byd-partial',
  query: '比亚迪',
  objectName: 'BYD Company',
  companyName: 'BYD',
  status: 'PARTIAL',
};

const BYD_RECORD: ResearchHistoryRecord = {
  taskId: 'task-byd',
  query: '比亚迪',
  objectType: 'company',
  objectName: 'BYD Company',
  companyName: 'BYD',
  stockCode: '1211',
  market: 'HK',
  status: 'COMPLETED',
  createdAt: '2026-07-10T09:00:00Z',
};

const APPLE_RECORD: ResearchHistoryRecord = {
  taskId: 'task-apple',
  query: '苹果',
  objectType: 'company',
  objectName: 'Apple',
  companyName: 'Apple',
  stockCode: 'AAPL',
  market: 'US',
  status: 'COMPLETED',
  createdAt: '2026-07-05T09:00:00Z',
};

function pageOf(records: ResearchHistoryRecord[], size = 10): ResearchHistoryPage {
  return { total: records.length, page: 1, size, records };
}

function signIn() {
  useAuthStore.getState().setSession('test-token', { userId: 'u-1', email: 'demo@example.com' });
}

function renderHistoryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/history']}>
          <HistoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('HistoryPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    listHistoryMock.mockReset();
    deleteHistoryRecordMock.mockReset();
    useAuthStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().clear();
  });

  it('previews up to three anonymous records and guides visitors to sign in for the full history', async () => {
    listHistoryMock.mockResolvedValue(
      pageOf([NVIDIA_RECORD, TENCENT_RECORD, BYD_RECORD, APPLE_RECORD], 3),
    );
    renderHistoryPage();

    expect(
      await screen.findByRole('link', { name: 'View the report for NVIDIA' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the report for BYD' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'View the report for Apple' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in to unlock your full history' }),
    ).toBeInTheDocument();
    // 登录改成了就地弹窗，这个入口不再是跳 /login 的链接
    expect(screen.getByRole('button', { name: 'Sign in to view all history' })).toBeInTheDocument();
    expect(listHistoryMock).toHaveBeenCalledWith({ keyword: undefined, page: 1, size: 3 });
  });

  it('renders every required field on a record card and links it to the result route', async () => {
    listHistoryMock.mockResolvedValue(pageOf([NVIDIA_RECORD]));
    signIn();

    renderHistoryPage();

    const link = await screen.findByRole('link', { name: 'View the report for NVIDIA' });
    expect(link).toHaveAttribute('href', '/research/task-nvidia/result');

    // 公司名称 / 股票代码 / 上市市场
    expect(screen.getByText('NVIDIA · NVDA · US')).toBeInTheDocument();
    // 原始研究对象
    expect(screen.getByText('英伟达')).toBeInTheDocument();
    // 对象类型
    expect(screen.getByText('Company')).toBeInTheDocument();
    // 任务状态
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // 综合结论（decision + confidence）
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('High confidence')).toBeInTheDocument();
    // 创建时间（与组件同一种格式化方式，避免在测试里断言一个猜测的字符串）
    const expectedDate = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(NVIDIA_RECORD.createdAt));
    expect(screen.getByText(expectedDate)).toBeInTheDocument();

    expect(listHistoryMock).toHaveBeenCalledWith({ keyword: undefined, page: 1, size: 10 });
  });

  it('routes incomplete records to progress and uses the progress action label', async () => {
    listHistoryMock.mockResolvedValue(pageOf([BYD_PARTIAL_RECORD, TENCENT_RECORD]));
    signIn();

    renderHistoryPage();

    const partialLink = await screen.findByRole('link', { name: 'View progress for BYD' });
    expect(partialLink).toHaveAttribute('href', '/research/task-byd-partial/progress');
    expect(screen.getByRole('link', { name: 'View progress for Tencent' })).toHaveAttribute(
      'href',
      '/research/task-tencent/progress',
    );
  });

  it('does not show final report retry in the history page', async () => {
    listHistoryMock.mockResolvedValue(pageOf([REPORT_RETRY_RECORD]));
    signIn();

    renderHistoryPage();

    await screen.findByText('Report retry company');
    expect(
      screen.queryByRole('button', { name: 'Regenerate the report for Report Retry Co' }),
    ).not.toBeInTheDocument();
  });

  it('shows one card skeleton while history is loading', async () => {
    listHistoryMock.mockReturnValue(new Promise<ResearchHistoryPage>(() => {}));
    signIn();

    renderHistoryPage();

    expect(await screen.findByRole('status', { name: 'Loading research history' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText('Research object')).not.toBeInTheDocument();
  });

  it('shows the no-research-yet empty state when the account has no saved research', async () => {
    listHistoryMock.mockResolvedValue(pageOf([]));
    signIn();

    renderHistoryPage();

    expect(await screen.findByRole('heading', { name: 'No research yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start research' })).toHaveAttribute(
      'href',
      '/research/new',
    );
  });

  it('shows the no-matching-history state for a search with zero hits, with clear-search and home actions', async () => {
    const user = userEvent.setup();
    listHistoryMock.mockImplementation(async (params: { keyword?: string }) =>
      params.keyword ? pageOf([]) : pageOf([NVIDIA_RECORD]),
    );
    signIn();

    renderHistoryPage();
    await screen.findByRole('link', { name: 'View the report for NVIDIA' });

    await user.type(
      screen.getByRole('searchbox', { name: 'Search research history' }),
      'no-such-company',
    );

    expect(
      await screen.findByRole('heading', { name: 'No matching history found.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Return to home and start new research' }),
    ).toHaveAttribute('href', '/');

    await user.click(screen.getByRole('button', { name: 'Clear this search' }));

    await screen.findByRole('link', { name: 'View the report for NVIDIA' });
  });

  it('asks for confirmation before deleting, and removes only the confirmed record from the list', async () => {
    const user = userEvent.setup();
    listHistoryMock.mockResolvedValue(pageOf([NVIDIA_RECORD, TENCENT_RECORD]));
    deleteHistoryRecordMock.mockResolvedValue(undefined);
    signIn();

    renderHistoryPage();
    await screen.findByRole('link', { name: 'View the report for NVIDIA' });

    await user.click(screen.getByRole('button', { name: 'Delete NVIDIA' }));
    expect(
      await screen.findByText(
        'Deleting removes this research record and its report from your history, and this cannot be undone.',
      ),
    ).toBeInTheDocument();

    // 取消：不调用删除接口，记录保留。
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteHistoryRecordMock).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'View the report for NVIDIA' })).toBeInTheDocument();

    // 再次删除并确认：只移除这一条，另一条保留。
    await user.click(screen.getByRole('button', { name: 'Delete NVIDIA' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(deleteHistoryRecordMock).toHaveBeenCalledWith('task-nvidia'));
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'View the report for NVIDIA' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'View progress for Tencent' })).toBeInTheDocument();
  });
});
