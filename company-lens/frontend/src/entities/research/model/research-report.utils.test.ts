import { describe, expect, it } from 'vitest';

import type { AgentReport, ResearchMessage } from './research.types';
import { appendResearchMessageToReport } from './research-report.utils';

const BASE_REPORT: AgentReport = {
  projectId: 'project-1',
  agentId: 'agent-1',
  agentType: 'industry_research',
  status: 'running',
  reportStatus: 'unavailable',
  reportReady: false,
};

function createMessage(
  messageId: string,
  content: string,
  contentType: ResearchMessage['contentType'],
): ResearchMessage {
  return {
    messageId,
    conversationId: 'conversation-1',
    projectId: 'project-1',
    agentRunId: 'agent-1',
    role: 'ASSISTANT',
    content,
    contentType,
    stage: 'REPORT',
  };
}

describe('appendResearchMessageToReport', () => {
  it('preserves content types and only merges adjacent blocks with the same format', () => {
    const first = appendResearchMessageToReport(
      BASE_REPORT,
      createMessage('message-1', '## Markdown report', 'MARKDOWN'),
    );
    const merged = appendResearchMessageToReport(
      first,
      createMessage('message-2', 'More Markdown', 'MARKDOWN'),
    );
    const mixed = appendResearchMessageToReport(
      merged,
      createMessage('message-3', 'Plain text', 'TEXT'),
    );

    expect(mixed.blocks).toEqual([
      expect.objectContaining({
        content: '## Markdown report\n\nMore Markdown',
        contentType: 'MARKDOWN',
        messageIds: ['message-1', 'message-2'],
      }),
      expect.objectContaining({
        content: 'Plain text',
        contentType: 'TEXT',
        messageIds: ['message-3'],
      }),
    ]);
  });
});
