import { describe, expect, it } from 'vitest';

import type { ResearchMessage } from './research.types';
import {
  createResearchThinkingStepFromEvent,
  extractResearchThinkingSteps,
  mergeResearchThinkingSteps,
} from './research-thinking.utils';

function thinkingMessage(
  messageId: string,
  metadata: unknown,
  agentRunId = 'agent-1',
): ResearchMessage {
  return {
    messageId,
    conversationId: 'conversation-1',
    projectId: 'project-1',
    agentRunId,
    role: 'ASSISTANT',
    content: 'Thinking',
    contentType: 'TEXT',
    stage: 'THINKING',
    metadata,
    createdAt: '2026-07-23 14:31:35',
  };
}

describe('research thinking steps', () => {
  it('extracts object and legacy string steps from object or JSON-string metadata', () => {
    const steps = extractResearchThinkingSteps([
      thinkingMessage('message-1', {
        steps: [
          {
            summary: '正在检索行业资料',
            agentName: 'industry_research_agent',
            displayName: '行业研究',
            progress: 50,
            title: '数据检索中',
          },
        ],
      }),
      thinkingMessage('message-2', JSON.stringify({ steps: ['正在生成研究结论'] })),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      agentId: 'agent-1',
      agentType: 'industry_research_agent',
      summary: '正在检索行业资料',
      progressPercent: 50,
      title: '数据检索中',
    });
    expect(steps[1]).toMatchObject({ agentId: 'agent-1', summary: '正在生成研究结论' });
  });

  it('rejects private, empty, exact noise and invalid-progress steps without fuzzy filtering', () => {
    const steps = extractResearchThinkingSteps([
      thinkingMessage('message-1', {
        steps: [
          { summary: 'private trace', agentName: 'agent', progress: 10, visibility: 'private' },
          { summary: "today's date", agentName: 'agent', progress: 20 },
          { summary: '   ', agentName: 'agent', progress: 30 },
          { summary: 'invalid progress', agentName: 'agent', progress: 140 },
          {
            summary: '当前日期字段将作为数据质量检查项继续验证',
            agentName: 'agent',
            progress: 40,
            visibility: 'public',
          },
        ],
      }),
    ]);

    expect(steps).toEqual([
      expect.objectContaining({
        summary: '当前日期字段将作为数据质量检查项继续验证',
        progressPercent: 40,
      }),
    ]);
  });

  it('maps user-safe SSE progress and deduplicates it against matching history', () => {
    const liveStep = createResearchThinkingStepFromEvent({
      type: 'agent_progress',
      projectId: 'project-1',
      agentId: 'agent-1',
      agentType: 'industry_research_agent',
      displayName: '行业研究',
      progressPercent: 50,
      summary: '正在检索行业资料',
      title: '数据检索中',
      visibility: 'user_safe',
      sourceRefs: ['source-1', 'source-1'],
      seq: 8,
    });
    const historySteps = extractResearchThinkingSteps([
      thinkingMessage('message-1', {
        steps: [
          {
            summary: '正在检索行业资料',
            agentName: 'industry_research_agent',
            displayName: '行业研究',
            progress: 50,
            title: '数据检索中',
          },
        ],
      }),
    ]);

    expect(liveStep).toMatchObject({ sourceRefs: ['source-1'], seq: 8 });
    expect(mergeResearchThinkingSteps(historySteps, liveStep ? [liveStep] : [])).toHaveLength(1);
  });

  it('does not construct a live step when visibility is missing or not user-safe', () => {
    const baseEvent = {
      type: 'agent_progress' as const,
      projectId: 'project-1',
      agentId: 'agent-1',
      agentType: 'industry_research_agent',
      progressPercent: 50,
      summary: '内部调用参数',
      seq: 8,
    };

    expect(createResearchThinkingStepFromEvent(baseEvent)).toBeUndefined();
    expect(
      createResearchThinkingStepFromEvent({ ...baseEvent, visibility: 'internal' }),
    ).toBeUndefined();
  });
});
