import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOCK_RESEARCH_SCENARIOS } from '../testing/research-fixtures';
import type { ResearchEventHandlers } from '../model/research.types';
import type { ResearchRepository } from './research.repository';
import { resetResearchComposition, setResearchRepositoryForTest } from './research.composition';
import {
  researchQueryKeys,
  useResearchProjectEvents,
  useResearchThinkingSteps,
} from './research.queries';

describe('research thinking query flow', () => {
  afterEach(() => {
    resetResearchComposition();
  });

  it('merges REST history with user-safe SSE steps and rejects an unknown Agent', async () => {
    const snapshot = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot;
    const agent = snapshot.progress.agentTasks[0];
    let handlers: ResearchEventHandlers | undefined;
    const repository: ResearchRepository = {
      searchStockCandidates: vi.fn(),
      createResearch: vi.fn(),
      confirmResearchResolution: vi.fn(),
      getProjectSnapshot: vi.fn().mockResolvedValue(snapshot),
      getConversationMessages: vi.fn().mockResolvedValue([
        {
          messageId: 'message-1',
          conversationId: 'conversation-1',
          projectId: snapshot.project.projectId,
          agentRunId: agent.agentId,
          role: 'ASSISTANT',
          content: 'Thinking',
          contentType: 'TEXT',
          stage: 'THINKING',
          metadata: {
            steps: [
              {
                summary: '正在建立研究上下文',
                agentName: agent.agentType,
                progress: 10,
              },
            ],
          },
        },
      ]),
      getAgentReport: vi.fn(),
      getCompany: vi.fn(),
      retryAgent: vi.fn(),
      subscribeProjectEvents: vi.fn((_projectId, _afterSeq, nextHandlers) => {
        handlers = nextHandlers;
        return { unsubscribe: vi.fn() };
      }),
    };
    setResearchRepositoryForTest(repository);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(
      researchQueryKeys.projectSnapshot(snapshot.project.projectId),
      snapshot,
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const thinking = renderHook(
      () => {
        const steps = useResearchThinkingSteps(snapshot.project.projectId, 'conversation-1');
        useResearchProjectEvents(snapshot.project.projectId);
        return steps;
      },
      { wrapper },
    );

    await waitFor(() => expect(thinking.result.current).toHaveLength(1));
    await waitFor(() => expect(handlers).toBeDefined());

    act(() => {
      handlers?.onEvent?.({
        type: 'agent_progress',
        projectId: snapshot.project.projectId,
        agentId: agent.agentId,
        agentType: agent.agentType,
        progressPercent: 35,
        summary: '正在补充市场规模证据',
        title: '扩展市场证据',
        visibility: 'public',
        seq: 2,
      });
      handlers?.onEvent?.({
        type: 'agent_progress',
        projectId: snapshot.project.projectId,
        agentId: 'unknown-agent',
        agentType: 'unknown_agent',
        progressPercent: 40,
        summary: '不应展示的错误归属过程',
        visibility: 'public',
        seq: 3,
      });
    });

    await waitFor(() => expect(thinking.result.current).toHaveLength(2));
    expect(thinking.result.current.map((step) => step.summary)).toEqual([
      '正在建立研究上下文',
      '正在补充市场规模证据',
    ]);
  });
});
