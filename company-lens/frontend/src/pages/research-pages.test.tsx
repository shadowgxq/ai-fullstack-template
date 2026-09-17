import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  setCompanyResearchRepositoryForTests,
  type CompanyResearchRepository,
  type CompanyResearchTask,
} from '../entities/company-research';
import { useAuthStore, useLoginModal } from '../features/auth';
import { i18n } from '../shared/i18n';
import { AgentReportPage } from './agent-report';
import { ResearchProgressPage } from './research-progress';
import {
  getOrCreateResearchProgressRecord,
  persistResearchProgressRecord,
  readResearchProgressRecord,
} from './research-progress/model/research-progress-storage';
import { ResearchResultPage } from './research-result';

const completedTask: CompanyResearchTask = {
  taskId: '90071992547409931234',
  query: '黄仁勋',
  status: 'completed',
  reportReady: true,
  objectType: 'person',
  objectName: '黄仁勋',
  companyName: 'NVIDIA Corporation',
  stockCode: 'NVDA',
  market: 'NASDAQ',
  industry: 'Semiconductors',
  keyPeople: 'Jensen Huang',
  objectRelation: 'Founder and CEO',
  researchFocus: 'Quality and valuation',
  capabilities: [
    { name: 'investment_research_agent', status: 'succeeded', retryable: true },
    { name: 'investment_team_agent', status: 'succeeded', retryable: true },
    { name: 'management_deep_dive_agent', status: 'succeeded', retryable: true },
    { name: 'synthesis', status: 'succeeded' },
  ],
};

function createRepository(
  task = completedTask,
  overrides: Partial<CompanyResearchRepository> = {},
): CompanyResearchRepository {
  return {
    subscribeRecognition: vi.fn(() => ({ close: vi.fn() })),
    createTask: vi.fn(),
    getTask: vi.fn().mockResolvedValue(task),
    getReport: vi.fn().mockResolvedValue({
      report: {
        overall_conclusion: {
          decision: 'BUY',
          confidence: 'HIGH',
          companyQuality: 'High quality',
        },
        direct_answer: 'The person remains a material factor in the company thesis.',
        business_model: { judgment: 'Platform economics' },
        sources: [{ title: 'Annual report', url: 'https://example.com' }],
      },
    }),
    getCapabilityResult: vi.fn().mockResolvedValue({
      agentName: 'investment_research',
      reportReady: true,
    }),
    retryCapability: vi.fn(),
    retryReport: vi.fn(),
    listHistory: vi.fn(),
    deleteHistory: vi.fn(),
    bindTask: vi.fn(),
    subscribeEvents: vi.fn(() => ({ close: vi.fn() })),
    ...overrides,
  };
}

function renderAt(element: React.ReactElement, entry: string, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

type CompanyResearchReportDocument = Awaited<ReturnType<CompanyResearchRepository['getReport']>>;

describe('company research route pages', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useAuthStore.setState({ token: null, user: null });
    useLoginModal.getState().closeLogin();
  });
  afterEach(() => {
    cleanup();
    setCompanyResearchRepositoryForTests(undefined);
    vi.restoreAllMocks();
  });

  it('restores the task by its string id and exposes the report only in a terminal state', async () => {
    const repository = createRepository({
      ...completedTask,
      systemMessages: [
        {
          id: 'message-system-1',
          role: 'system',
          content: 'Task created',
          stage: 'TASK_CREATED',
          seq: 1,
        },
      ],
      agents: [
        {
          agentRunId: 'agent-run-1',
          agentName: 'investment_research_agent',
          displayName: 'Investment research',
          skillName: 'investment-research',
          eventAgentName: 'investment_research_agent',
          status: 'succeeded',
          progress: 100,
          summary: 'Public filings reviewed.',
          messages: [
            {
              id: 'message-agent-1',
              agentRunId: 'agent-run-1',
              role: 'assistant',
              content: 'Public filings reviewed.',
              stage: 'THINKING',
              seq: 2,
              metadata: [
                {
                  title: 'Sources',
                  summary: 'Annual report reviewed.',
                  visibility: 'user_safe',
                },
              ],
            },
          ],
        },
      ],
    });
    setCompanyResearchRepositoryForTests(repository);
    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );
    expect(await screen.findByRole('heading', { name: '黄仁勋' })).toBeInTheDocument();
    expect(repository.getTask).toHaveBeenCalledWith(completedTask.taskId, {
      includeMessages: true,
    });
    expect(screen.getByRole('link', { name: /View report/ })).toHaveAttribute(
      'href',
      `/research/${completedTask.taskId}/result`,
    );
    expect(screen.getByRole('heading', { name: 'Specialist agents' })).toBeInTheDocument();
    expect(screen.getByText('Founder and CEO')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Research activity' })).not.toBeInTheDocument();
    expect(await screen.findAllByText('Annual report reviewed.')).not.toHaveLength(0);
  });

  it('renders the locale-specific industry field on the progress page', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository({
        ...completedTask,
        industry: '制药与医疗保健',
        industryZh: '制药与医疗保健',
        industryEn: 'Pharmaceuticals & Healthcare',
      }),
    );

    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    expect(await screen.findByText('Pharmaceuticals & Healthcare')).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('zh');
    });
    expect(await screen.findByText('制药与医疗保健')).toBeInTheDocument();
  });

  it('assigns team events to the team row and refreshes its latest progress from SSE snapshots', async () => {
    const teamEvents = (
      latestSummary: string,
    ): NonNullable<CompanyResearchTask['agents']>[number]['messages'] => [
      {
        id: 'team-thinking-1',
        agentRunId: 'team-run-1',
        role: 'assistant',
        stage: 'THINKING',
        seq: 10,
        metadata: [
          {
            seq: 21,
            eventAgentName: 'business_analyst',
            title: 'capability_started',
            eventType: 'capability_started',
            summary: 'Business model evidence collected.',
            sourceRefs: [{ url: 'https://example.com/business', title: 'Business evidence' }],
            visibility: 'user_safe',
          },
          {
            seq: 22,
            eventAgentName: 'team_lead',
            title: 'Team review',
            summary: latestSummary,
            visibility: 'public',
          },
        ],
      },
    ];
    const createTaskSnapshot = (latestSummary: string): CompanyResearchTask => ({
      ...completedTask,
      status: 'analyzing',
      reportReady: false,
      systemMessages: [{ id: 'system-1', stage: 'TASK_CREATED', content: 'Task created', seq: 1 }],
      capabilities: [
        { name: 'investment_research_agent', status: 'succeeded' },
        { name: 'investment_team', status: 'running' },
        { name: 'management_deep_dive', status: 'pending' },
      ],
      agents: [
        {
          agentRunId: 'team-run-1',
          agentName: 'investment_team_agent',
          displayName: 'Specialist team',
          skillName: 'investment-team',
          status: 'running',
          progress: latestSummary === 'Team review is complete.' ? 76 : 44,
          summary: latestSummary,
          messages: teamEvents(latestSummary),
        },
      ],
    });
    const initialTask = createTaskSnapshot('Team review is in progress.');
    const updatedTask = createTaskSnapshot('Financial analyst update is ready.');
    const getTask = vi.fn().mockResolvedValueOnce(initialTask).mockResolvedValueOnce(updatedTask);
    let emitEvent: (() => void) | undefined;
    const subscribeEvents: CompanyResearchRepository['subscribeEvents'] = vi.fn(
      (_taskId, handlers) => {
        emitEvent = () => handlers.onEvent({ type: 'agent_progress', isTerminal: false });
        return { close: vi.fn() };
      },
    );
    setCompanyResearchRepositoryForTests(
      createRepository(initialTask, { getTask, subscribeEvents }),
    );
    const user = userEvent.setup();

    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    const teamButton = await screen.findByRole('button', { name: /Specialist team/ });
    expect(teamButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(teamButton);
    const teamRow = teamButton.closest('li') as HTMLElement;
    expect(within(teamRow).getByText('Business Analyst')).toBeInTheDocument();
    expect(within(teamRow).getByText('Team Lead')).toBeInTheDocument();
    expect(within(teamRow).getByText('Research capability started')).toBeInTheDocument();
    expect(within(teamRow).getByRole('link', { name: 'Business evidence' })).toHaveAttribute(
      'href',
      'https://example.com/business',
    );
    expect(within(teamButton).getByText('Team review is in progress.')).toBeInTheDocument();
    expect(screen.queryByText('Financial analyst update is ready.')).not.toBeInTheDocument();

    expect(subscribeEvents).toHaveBeenCalledWith(completedTask.taskId, expect.any(Object));
    act(() => emitEvent?.());
    await waitFor(() => {
      expect(screen.getAllByText('Financial analyst update is ready.')).not.toHaveLength(0);
    });
    expect(getTask).toHaveBeenCalledTimes(2);
  });

  it('does not render inferred seven-stage progress when the API task has no stages', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository({ ...completedTask, status: 'analyzing' }),
    );
    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );
    expect(await screen.findByText('Analyzing')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Research stages' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View report/ })).not.toBeInTheDocument();
  });

  it('shows the summary report generating state after all capabilities finish', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository({
        ...completedTask,
        status: 'collecting',
        reportReady: false,
      }),
    );
    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    expect(await screen.findByText('Generating summary report')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View report/ })).not.toBeInTheDocument();
  });

  it('does not show summary report generation after the task fails', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository({
        ...completedTask,
        status: 'failed',
        reportReady: false,
      }),
    );
    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    expect(await screen.findAllByText('Research failed')).not.toHaveLength(0);
    expect(screen.queryByText('Generating summary report')).not.toBeInTheDocument();
    expect(screen.queryByText('System error, please try again later.')).not.toBeInTheDocument();
  });

  it('does not repeat the generic failure reason inside the failed progress card', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository({
        ...completedTask,
        status: 'failed',
        reportReady: false,
        failReason: 'Unexpected upstream failure',
      }),
    );

    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    expect(await screen.findAllByText('Research failed')).not.toHaveLength(0);
    expect(screen.queryByText('System error, please try again later.')).not.toBeInTheDocument();
  });

  it('uses the completed-Agent checkpoint and persists the terminal status', async () => {
    localStorage.clear();
    const now = Date.now();
    const record = getOrCreateResearchProgressRecord(completedTask.taskId, now)!;
    persistResearchProgressRecord(
      completedTask.taskId,
      { ...record, lastProgress: 98, status: 'analyzing' },
      now + 1,
    );
    const repository = createRepository({
      ...completedTask,
      status: 'failed',
      reportReady: false,
    });
    setCompanyResearchRepositoryForTests(repository);

    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    await waitFor(() =>
      expect(repository.getTask).toHaveBeenCalledWith(completedTask.taskId, {
        includeMessages: true,
      }),
    );
    expect(await screen.findAllByText('Research failed')).not.toHaveLength(0);
    const progressBar = await screen.findByRole('progressbar', {
      name: 'Overall research progress',
    });
    expect(progressBar).toHaveValue(99);
    expect(progressBar.closest('section')).not.toHaveAttribute('data-running');
    expect(readResearchProgressRecord(completedTask.taskId)).toMatchObject({
      lastProgress: 99,
      status: 'failed',
    });
    expect(readResearchProgressRecord('2084456747018035201')).toBeUndefined();
    localStorage.clear();
  });

  it('uses the completed-Agent ratio when the saved checkpoint is zero', async () => {
    localStorage.clear();
    const now = Date.now();
    const failedTask: CompanyResearchTask = {
      ...completedTask,
      status: 'failed',
      reportReady: false,
      capabilities: [
        { name: 'investment_research_agent', status: 'succeeded' },
        { name: 'investment_team_agent', status: 'succeeded' },
        { name: 'management_deep_dive_agent', status: 'failed' },
      ],
      agents: [
        {
          agentName: 'investment_research_agent',
          status: 'succeeded',
          progress: 100,
          messages: [],
        },
        {
          agentName: 'investment_team_agent',
          status: 'succeeded',
          progress: 100,
          messages: [],
        },
        {
          agentName: 'management_deep_dive_agent',
          status: 'failed',
          progress: 42,
          messages: [],
        },
      ],
    };
    const record = getOrCreateResearchProgressRecord(failedTask.taskId, now)!;
    expect(record.lastProgress).toBe(0);
    const repository = createRepository(failedTask);
    setCompanyResearchRepositoryForTests(repository);

    renderAt(
      <ResearchProgressPage />,
      `/research/${failedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    await waitFor(() =>
      expect(repository.getTask).toHaveBeenCalledWith(failedTask.taskId, {
        includeMessages: true,
      }),
    );
    expect(await screen.findAllByText('Research failed')).not.toHaveLength(0);
    const progressBar = await screen.findByRole('progressbar', {
      name: 'Overall research progress',
    });
    expect(progressBar).toHaveValue(66);
    expect(readResearchProgressRecord(failedTask.taskId)).toMatchObject({
      lastProgress: 66,
      status: 'failed',
    });
    localStorage.clear();
  });

  it('freezes progress when an Agent fails before the task becomes terminal', async () => {
    localStorage.clear();
    const now = Date.now();
    const taskWithFailedAgent: CompanyResearchTask = {
      ...completedTask,
      status: 'analyzing',
      reportReady: false,
      capabilities: [
        { name: 'investment_research_agent', status: 'succeeded' },
        { name: 'investment_team_agent', status: 'succeeded' },
        { name: 'management_deep_dive_agent', status: 'failed' },
      ],
      agents: [
        {
          agentName: 'investment_research_agent',
          status: 'succeeded',
          progress: 100,
          messages: [],
        },
        {
          agentName: 'investment_team_agent',
          status: 'succeeded',
          progress: 100,
          messages: [],
        },
        {
          agentName: 'management_deep_dive_agent',
          status: 'failed',
          progress: 42,
          messages: [],
        },
      ],
    };
    const record = getOrCreateResearchProgressRecord(taskWithFailedAgent.taskId, now)!;
    persistResearchProgressRecord(
      taskWithFailedAgent.taskId,
      { ...record, lastProgress: 20, status: 'analyzing' },
      now + 1,
    );
    const repository = createRepository(taskWithFailedAgent);
    setCompanyResearchRepositoryForTests(repository);

    renderAt(
      <ResearchProgressPage />,
      `/research/${taskWithFailedAgent.taskId}/progress`,
      '/research/:projectId/progress',
    );

    const progressBar = await screen.findByRole('progressbar', {
      name: 'Overall research progress',
    });
    expect(progressBar).toHaveValue(20);
    expect(progressBar.closest('section')).not.toHaveAttribute('data-running');
    expect(readResearchProgressRecord(taskWithFailedAgent.taskId)).toMatchObject({
      lastProgress: 20,
      status: 'analyzing',
    });
    localStorage.clear();
  });

  it('keeps a 100 percent running Agent in the report-pending state', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository({
        ...completedTask,
        status: 'analyzing',
        reportReady: false,
        capabilities: [{ name: 'investment_research_agent', status: 'running' }],
        agents: [
          {
            agentName: 'investment_research_agent',
            status: 'running',
            progress: 100,
            messages: [],
          },
        ],
      }),
    );

    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    expect(
      await screen.findByText('Thinking finished; waiting for the report'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View report/ })).not.toBeInTheDocument();
  });

  it('shows partial impact and retries only the failed capability', async () => {
    let finishRetry: (() => void) | undefined;
    const retryCapability = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRetry = resolve;
        }),
    );
    setCompanyResearchRepositoryForTests(
      createRepository(
        {
          ...completedTask,
          status: 'partial',
          failReason: 'Management research is missing.',
          capabilities: completedTask.capabilities.map((item) =>
            item.name.includes('management')
              ? { ...item, status: 'failed' as const, retryable: false }
              : item,
          ),
        },
        { retryCapability },
      ),
    );
    const user = userEvent.setup();
    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );
    expect(await screen.findAllByText('System error, please try again later.')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Retry Agent' }));
    expect(await screen.findByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(retryCapability).toHaveBeenCalledWith(
      completedTask.taskId,
      'management_deep_dive_agent',
    );
    finishRetry?.();
  });

  it('shows final report retry for a failed task with all Agents done and no final report', async () => {
    localStorage.clear();
    let taskWithSynthesisFailure: CompanyResearchTask = {
      ...completedTask,
      status: 'failed',
      reportReady: false,
      finalResultAvailable: false,
      synthesisFailed: true,
      failReason: 'Final report synthesis failed.',
      capabilities: [
        { name: 'investment_research_agent', status: 'succeeded' },
        { name: 'investment_team_agent', status: 'succeeded' },
        { name: 'management_deep_dive_agent', status: 'succeeded' },
      ],
      agents: [
        { agentName: 'investment_research_agent', status: 'succeeded', messages: [] },
        { agentName: 'investment_team_agent', status: 'succeeded', messages: [] },
        { agentName: 'management_deep_dive_agent', status: 'succeeded', messages: [] },
      ],
    };
    const retryReport = vi.fn().mockImplementation(async () => {
      taskWithSynthesisFailure = {
        ...taskWithSynthesisFailure,
        status: 'collecting',
      };
    });
    const repository = createRepository(taskWithSynthesisFailure, {
      getTask: vi.fn().mockImplementation(async () => taskWithSynthesisFailure),
      retryReport,
    });
    setCompanyResearchRepositoryForTests(repository);

    const user = userEvent.setup();
    renderAt(
      <ResearchProgressPage />,
      `/research/${taskWithSynthesisFailure.taskId}/progress`,
      '/research/:projectId/progress',
    );

    const retryReportButton = await screen.findByRole('button', { name: 'Regenerate report' });
    expect(retryReportButton.closest('header')).toBeInTheDocument();
    await user.click(retryReportButton);
    await waitFor(() => expect(retryReport).toHaveBeenCalledWith(taskWithSynthesisFailure.taskId));
    expect(screen.queryByRole('button', { name: 'Retry Agent' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'Overall research progress' })).toHaveValue(
        80,
      ),
    );
    expect(readResearchProgressRecord(taskWithSynthesisFailure.taskId)).toMatchObject({
      lastProgress: 80,
      status: 'collecting',
    });
    localStorage.clear();
  });

  it('hides final report retry when synthesis failure is not confirmed', async () => {
    localStorage.clear();
    const taskWithoutSynthesisFailure: CompanyResearchTask = {
      ...completedTask,
      status: 'failed',
      reportReady: false,
      finalResultAvailable: false,
      synthesisFailed: false,
      capabilities: completedTask.capabilities.map((item) => ({
        ...item,
        status: 'succeeded' as const,
      })),
      agents: (completedTask.agents ?? []).map((agent) => ({
        ...agent,
        status: 'succeeded' as const,
      })),
    };
    setCompanyResearchRepositoryForTests(createRepository(taskWithoutSynthesisFailure));

    renderAt(
      <ResearchProgressPage />,
      `/research/${taskWithoutSynthesisFailure.taskId}/progress`,
      '/research/:projectId/progress',
    );

    await screen.findByText('Research failed');
    expect(screen.queryByRole('button', { name: 'Regenerate report' })).not.toBeInTheDocument();
    localStorage.clear();
  });

  it('shows final report retry failures in a centered bottom toast', async () => {
    localStorage.clear();
    const failedTask: CompanyResearchTask = {
      ...completedTask,
      status: 'failed',
      reportReady: false,
      finalResultAvailable: false,
      synthesisFailed: true,
      failReason: 'Final report synthesis failed.',
      capabilities: [
        { name: 'investment_research_agent', status: 'succeeded' },
        { name: 'investment_team_agent', status: 'succeeded' },
        { name: 'management_deep_dive_agent', status: 'succeeded' },
      ],
      agents: [
        { agentName: 'investment_research_agent', status: 'succeeded', messages: [] },
        { agentName: 'investment_team_agent', status: 'succeeded', messages: [] },
        { agentName: 'management_deep_dive_agent', status: 'succeeded', messages: [] },
      ],
    };
    const retryReport = vi.fn().mockRejectedValue(new Error('Request failed'));
    setCompanyResearchRepositoryForTests(
      createRepository(failedTask, {
        retryReport,
      }),
    );

    const user = userEvent.setup();
    renderAt(
      <ResearchProgressPage />,
      `/research/${failedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    await user.click(await screen.findByRole('button', { name: 'Regenerate report' }));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('System error, please try again later.');
    expect(toast.closest('section')).toBeNull();
    localStorage.clear();
  });

  it('disables failed capability retry while the research task is still running', async () => {
    const retryCapability = vi.fn().mockResolvedValue(undefined);
    setCompanyResearchRepositoryForTests(
      createRepository(
        {
          ...completedTask,
          status: 'analyzing',
          reportReady: false,
          capabilities: completedTask.capabilities.map((item) =>
            item.name.includes('management') ? { ...item, status: 'failed' as const } : item,
          ),
        },
        { retryCapability },
      ),
    );

    const user = userEvent.setup();
    renderAt(
      <ResearchProgressPage />,
      `/research/${completedTask.taskId}/progress`,
      '/research/:projectId/progress',
    );

    const retryButton = await screen.findByRole('button', { name: 'Retry Agent' });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute(
      'aria-describedby',
      'capability-detail-management_deep_dive_agent-retry-disabled',
    );
    expect(retryButton.parentElement).toHaveAttribute(
      'title',
      'Wait for the analysis to finish before retrying.',
    );

    await user.click(retryButton);
    expect(retryCapability).not.toHaveBeenCalled();
  });

  it('renders company metadata, typed conclusion, actual TOC, sources, and anonymous save', async () => {
    const repository = createRepository();
    setCompanyResearchRepositoryForTests(repository);
    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );
    const companySection = await screen.findByRole('heading', { name: 'Company information' });
    expect(repository.getTask).toHaveBeenCalledWith(completedTask.taskId, {
      includeMessages: false,
    });
    expect(
      within(companySection.parentElement as HTMLElement).getByText('NVDA'),
    ).toBeInTheDocument();
    expect(
      within(companySection.parentElement as HTMLElement).getByText('Key people'),
    ).toBeInTheDocument();
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'On this page' })).toHaveTextContent(
      'Business model',
    );
    // 登录改成就地弹窗后，绑定意图不再靠 URL 的 returnTo 往返携带，
    // 而是登记成「登录成功后续做」；点击应开弹窗并留下这个待办。
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to save' }));
    expect(useLoginModal.getState().open).toBe(true);
    expect(useLoginModal.getState().pendingAction).toBeTypeOf('function');
    expect(screen.getByRole('link', { name: 'View research progress' })).toHaveAttribute(
      'href',
      `/research/${completedTask.taskId}/progress`,
    );
    expect(
      screen.getByRole('link', { name: 'View the Company fundamentals Agent report' }),
    ).toHaveAttribute(
      'href',
      `/research/${completedTask.taskId}/agents/investment_research_agent/report`,
    );
    expect(screen.getAllByText('Read report')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Sources' })).toBeInTheDocument();
  });

  it('localizes duplicated Chinese industry fields in result metadata', async () => {
    const task = {
      ...completedTask,
      industry: '光通信设备',
      industryZh: '光通信设备',
      industryEn: '光通信设备',
    };
    setCompanyResearchRepositoryForTests(createRepository(task));

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    const englishHeading = await screen.findByRole('heading', { name: 'Company information' });
    const englishSection = englishHeading.closest('section') as HTMLElement;
    expect(within(englishSection).getByText('Optical communication equipment')).toBeInTheDocument();

    await i18n.changeLanguage('zh');
    const chineseHeading = await screen.findByRole('heading', { name: '公司信息' });
    const chineseSection = chineseHeading.closest('section') as HTMLElement;
    expect(within(chineseSection).getByText('光通信设备')).toBeInTheDocument();
  });

  it('shows anonymous save only after the report content has loaded', async () => {
    let resolveReport: (document: CompanyResearchReportDocument) => void = () => undefined;
    const reportPromise = new Promise<CompanyResearchReportDocument>((resolve) => {
      resolveReport = resolve;
    });
    setCompanyResearchRepositoryForTests(
      createRepository(completedTask, {
        getReport: vi.fn().mockReturnValue(reportPromise),
      }),
    );

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    expect(await screen.findByRole('heading', { name: 'Loading full report' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in to save' })).not.toBeInTheDocument();

    resolveReport({
      report: {
        direct_answer: 'The report content is ready.',
      },
    });

    expect(await screen.findByRole('heading', { name: 'Company information' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to save' })).toBeInTheDocument();
  });

  it('uses the report Markdown headings as a two-level result navigation', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository(completedTask, {
        getReport: vi.fn().mockResolvedValue({
          report: { direct_answer: 'The long-term thesis remains intact.' },
          reportMarkdown: [
            '# NVIDIA research report',
            '',
            '## Business quality',
            '',
            '### Competitive moat',
            '',
            '#### Supporting evidence',
            '',
            '## Risks',
          ].join('\n'),
        }),
      }),
    );

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    const outline = await screen.findByRole('navigation', { name: 'Document sections' });
    expect(within(outline).getByRole('link', { name: 'Business quality' })).toBeInTheDocument();
    expect(within(outline).getByRole('link', { name: 'Competitive moat' })).toBeInTheDocument();
    expect(within(outline).getByRole('link', { name: 'Risks' })).toBeInTheDocument();
    expect(
      within(outline).queryByRole('link', { name: 'Supporting evidence' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();
  });

  it('renders the V1.5 fixed conclusion fields with explicit insufficient-data values', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository(completedTask, {
        getReport: vi.fn().mockResolvedValue({
          report: {
            overallConclusion: {
              decision: 'HOLD',
              conclusion: 'HOLD',
              confidence: 'LOW',
              reason:
                'Business, industry and management evidence is positive, but valuation data is incomplete.',
              companyQuality: 'insufficient_data',
              valuationStatus: 'insufficient_data',
              longTermOutlook: 'insufficient_data',
              maximumOpportunity: 'insufficient_data',
              maximumRisk: 'insufficient_data',
            },
          },
        }),
      }),
    );

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    const conclusionHeading = await screen.findByRole('heading', { name: 'Overall conclusion' });
    const conclusionCard = conclusionHeading.closest('section') as HTMLElement;
    expect(within(conclusionCard).getByText('Hold')).toBeInTheDocument();
    expect(within(conclusionCard).getByText('Low')).toBeInTheDocument();
    expect(
      within(conclusionCard).getByText(
        'Business, industry and management evidence is positive, but valuation data is incomplete.',
      ),
    ).toBeInTheDocument();
    expect(within(conclusionCard).queryByText(/insufficient[_-]data/i)).not.toBeInTheDocument();
    expect(
      conclusionCard.querySelector('[data-conclusion-field="companyQuality"] dd'),
    ).toHaveTextContent('Insufficient data');
    expect(
      conclusionCard.querySelector('[data-conclusion-field="valuationStatus"] dd'),
    ).toHaveTextContent('Insufficient data');
    expect(
      conclusionCard.querySelector('[data-conclusion-field="longTermOutlook"] dd'),
    ).toHaveTextContent('Insufficient data');
    expect(
      conclusionCard.querySelector('[data-conclusion-field="biggestOpportunity"] dd'),
    ).toHaveTextContent('Insufficient data');
    expect(
      conclusionCard.querySelector('[data-conclusion-field="biggestRisk"] dd'),
    ).toHaveTextContent('Insufficient data');
  });

  it('exposes the complete long conclusion text through a focus tooltip', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}

        unobserve() {}

        disconnect() {}
      },
    );
    const opportunity =
      'AI infrastructure demand remains durable, while platform expansion, recurring software revenue, and operating leverage may support a longer runway than the current market narrative implies.';
    try {
      setCompanyResearchRepositoryForTests(
        createRepository(completedTask, {
          getReport: vi.fn().mockResolvedValue({
            report: {
              overallConclusion: {
                decision: 'HOLD',
                confidence: 'LOW',
                maximumOpportunity: opportunity,
                maximumRisk:
                  'A prolonged investment cycle could delay the expected return on capital.',
              },
            },
          }),
        }),
      );

      renderAt(
        <ResearchResultPage />,
        `/research/${completedTask.taskId}/result`,
        '/research/:projectId/result',
      );

      const conclusionHeading = await screen.findByRole('heading', { name: 'Overall conclusion' });
      const conclusionCard = conclusionHeading.closest('section') as HTMLElement;
      const opportunityTrigger = conclusionCard.querySelector(
        '[data-conclusion-field="biggestOpportunity"] [role="note"]',
      );
      if (!(opportunityTrigger instanceof HTMLElement)) {
        throw new Error('Expected a focusable opportunity text trigger.');
      }

      expect(opportunityTrigger).toHaveAttribute('aria-label', opportunity);
      opportunityTrigger.focus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent(opportunity);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('localizes conclusion enum values instead of rendering raw API keys', async () => {
    await i18n.changeLanguage('zh');
    setCompanyResearchRepositoryForTests(
      createRepository(completedTask, {
        getReport: vi.fn().mockResolvedValue({
          report: {
            overallConclusion: {
              decision: 'HOLD',
              confidence: 'LOW',
              companyQuality: 'FAIR',
              valuationStatus: 'FAIR',
              longTermOutlook: 'STABLE',
            },
          },
        }),
      }),
    );

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    const conclusionHeading = await screen.findByRole('heading', { name: '综合结论' });
    const conclusionCard = conclusionHeading.closest('section') as HTMLElement;
    expect(
      conclusionCard.querySelector('[data-conclusion-field="companyQuality"] dd'),
    ).toHaveTextContent('一般');
    expect(
      conclusionCard.querySelector('[data-conclusion-field="valuationStatus"] dd'),
    ).toHaveTextContent('合理估值');
    expect(
      conclusionCard.querySelector('[data-conclusion-field="longTermOutlook"] dd'),
    ).toHaveTextContent('稳定');
    expect(conclusionCard).not.toHaveTextContent('FAIR');
    expect(conclusionCard).not.toHaveTextContent('STABLE');

    await i18n.changeLanguage('en');
    const englishConclusionHeading = await screen.findByRole('heading', {
      name: 'Overall conclusion',
    });
    const englishConclusionCard = englishConclusionHeading.closest('section') as HTMLElement;
    expect(
      englishConclusionCard.querySelector('[data-conclusion-field="companyQuality"] dd'),
    ).toHaveTextContent('Fair');
    expect(
      englishConclusionCard.querySelector('[data-conclusion-field="valuationStatus"] dd'),
    ).toHaveTextContent('Fair value');
    expect(
      englishConclusionCard.querySelector('[data-conclusion-field="longTermOutlook"] dd'),
    ).toHaveTextContent('Stable');
    expect(englishConclusionCard).not.toHaveTextContent('FAIR');
    expect(englishConclusionCard).not.toHaveTextContent('STABLE');
  });

  it('localizes the direct answer reason in the conclusion card', async () => {
    const reasonZh = '四个研究角色均给出 HOLD，且当前无法完成完整财务交叉验证和合理价值计算。';
    const reasonEn =
      'All four research roles rate it HOLD, and a complete financial cross-verification and fair value calculation cannot currently be completed.';
    setCompanyResearchRepositoryForTests(
      createRepository(completedTask, {
        getReport: vi.fn().mockResolvedValue({
          report: {
            overallConclusion: { decision: 'HOLD', confidence: 'LOW' },
            directAnswer: { reason: '通用原因', reasonZh, reasonEn },
          },
        }),
      }),
    );

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    const englishConclusion = await screen.findByRole('heading', { name: 'Overall conclusion' });
    const englishCard = englishConclusion.closest('section') as HTMLElement;
    expect(englishCard).toHaveTextContent(reasonEn);
    expect(englishCard).not.toHaveTextContent(reasonZh);

    await i18n.changeLanguage('zh');
    const chineseConclusion = await screen.findByRole('heading', { name: '综合结论' });
    const chineseCard = chineseConclusion.closest('section') as HTMLElement;
    expect(chineseCard).toHaveTextContent(reasonZh);
    expect(chineseCard).not.toHaveTextContent(reasonEn);
  });

  it('renders the V1.5 report Markdown instead of duplicating structured sections', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository(completedTask, {
        getReport: vi.fn().mockResolvedValue({
          report: {
            overallConclusion: { decision: 'HOLD', confidence: 'LOW' },
            businessModel: { conclusion: 'Structured fallback' },
          },
          reportMarkdown: '# Server report\n\n## Financial quality\n\nVerified narrative.',
        }),
      }),
    );

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result`,
      '/research/:projectId/result',
    );

    expect(
      await screen.findByRole('heading', { name: 'Full research report' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Server report' })).toBeInTheDocument();
    expect(screen.queryByText('Structured fallback')).not.toBeInTheDocument();
  });

  it('renders capability markdown and source links without specialist normalized output', async () => {
    const repository = createRepository(
      {
        ...completedTask,
        capabilities: [{ name: 'investment_research', status: 'succeeded' }],
      },
      {
        getCapabilityResult: vi.fn().mockResolvedValue({
          agentName: 'investment_research',
          reportReady: true,
          reportMarkdown: '# Fundamentals\n\n**Verified** facts.',
          normalizedOutput: { researchability: 'RESEARCHABLE' },
          sources: [{ title: 'Annual report', url: 'https://example.com/annual-report' }],
        }),
      },
    );
    setCompanyResearchRepositoryForTests(repository);

    renderAt(
      <AgentReportPage />,
      `/research/${completedTask.taskId}/agents/investment_research/report`,
      '/research/:projectId/agents/:agentId/report',
    );

    expect(await screen.findByRole('heading', { name: 'Report content' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Company fundamentals report' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('companyResearch.agentReport.titleTemplate')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fundamentals' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Agent structured output' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Annual report' })).toHaveAttribute(
      'href',
      'https://example.com/annual-report',
    );
  });

  it('does not render an Agent report when the capability is not ready', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository(
        {
          ...completedTask,
          capabilities: [{ name: 'investment_research', status: 'succeeded' }],
        },
        {
          getCapabilityResult: vi.fn().mockResolvedValue({
            agentName: 'investment_research',
            reportReady: false,
            reportMarkdown: '# Stale report',
          }),
        },
      ),
    );

    renderAt(
      <AgentReportPage />,
      `/research/${completedTask.taskId}/agents/investment_research/report`,
      '/research/:projectId/agents/:agentId/report',
    );

    expect(
      await screen.findByRole('heading', { name: 'Agent report unavailable' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stale report' })).not.toBeInTheDocument();
  });

  it('renders normalized output for the summary capability only', async () => {
    setCompanyResearchRepositoryForTests(
      createRepository(
        {
          ...completedTask,
          capabilities: [{ name: 'synthesis', status: 'succeeded' }],
        },
        {
          getCapabilityResult: vi.fn().mockResolvedValue({
            agentName: 'synthesis',
            reportReady: true,
            normalizedOutput: { decision: 'HOLD' },
          }),
        },
      ),
    );

    renderAt(
      <AgentReportPage />,
      `/research/${completedTask.taskId}/agents/synthesis/report`,
      '/research/:projectId/agents/:agentId/report',
    );

    expect(
      await screen.findByRole('heading', { name: 'Agent structured output' }),
    ).toBeInTheDocument();
    expect(screen.getByText('HOLD')).toBeInTheDocument();
  });

  it('binds the existing anonymous task after login returns to the report', async () => {
    useAuthStore.setState({
      token: 'user-token',
      user: { userId: 'user-1', email: 'user@example.com' },
    });
    const bindTask = vi.fn().mockResolvedValue(undefined);
    setCompanyResearchRepositoryForTests(createRepository(completedTask, { bindTask }));

    renderAt(
      <ResearchResultPage />,
      `/research/${completedTask.taskId}/result?bind=pending`,
      '/research/:projectId/result',
    );

    await waitFor(() => {
      expect(bindTask).toHaveBeenCalledWith(completedTask.taskId);
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('keeps active TOC synchronization inside the TOC container', async () => {
    let notifyIntersection: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notifyIntersection = callback;
        }

        observe() {}

        disconnect() {}
      },
    );
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      setCompanyResearchRepositoryForTests(createRepository());
      renderAt(
        <ResearchResultPage />,
        `/research/${completedTask.taskId}/result`,
        '/research/:projectId/result',
      );

      await screen.findByRole('heading', { name: 'Company information' });
      const toc = screen.getByRole('navigation', { name: 'On this page' });
      const businessSection = document.getElementById('report-business_model');
      const businessLink = screen.getByRole('link', { name: 'Business model' });
      expect(businessSection).toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();

      Object.defineProperty(toc, 'scrollTop', { configurable: true, writable: true, value: 0 });
      vi.spyOn(toc, 'getBoundingClientRect').mockReturnValue({
        bottom: 300,
        height: 216,
        left: 0,
        right: 210,
        top: 84,
        width: 210,
        x: 0,
        y: 84,
        toJSON: () => ({}),
      });
      vi.spyOn(businessLink, 'getBoundingClientRect').mockReturnValue({
        bottom: 360,
        height: 40,
        left: 0,
        right: 200,
        top: 320,
        width: 200,
        x: 0,
        y: 320,
        toJSON: () => ({}),
      });

      act(() => {
        notifyIntersection?.(
          [
            {
              boundingClientRect: { top: 120 } as DOMRectReadOnly,
              intersectionRatio: 1,
              intersectionRect: {} as DOMRectReadOnly,
              isIntersecting: true,
              rootBounds: null,
              target: businessSection as HTMLElement,
              time: 0,
            },
          ],
          {} as IntersectionObserver,
        );
      });

      await waitFor(() => {
        expect(businessLink).toHaveAttribute('aria-current', 'location');
        expect(toc.scrollTop).toBe(60);
      });
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
      vi.unstubAllGlobals();
    }
  });
});
