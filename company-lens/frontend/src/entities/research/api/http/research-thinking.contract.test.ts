import { describe, expect, it } from 'vitest';

import { parseMessageVO, parseResearchSseEvent } from './research.dto';
import { mapMessageVOToResearchMessage, mapResearchSseEvent } from './research.mapper';

describe('research thinking API contract', () => {
  it('preserves documented agent_progress thinking fields through DTO parsing and mapping', () => {
    const dto = parseResearchSseEvent('agent_progress', {
      seq: 2,
      projectId: 'project-1',
      agentRunId: 'agent-1',
      agentName: 'industry_research_agent',
      displayName: '行业研究',
      progress: 50,
      summary: '已完成 3/5 数据源检索',
      title: '数据检索中',
      eventType: 'source_found',
      skillName: 'company_research',
      visibility: 'public',
      sourceRefs: ['source-1', 'source-2'],
      timestamp: '2026-07-23 14:31:35',
    });

    expect(mapResearchSseEvent(dto, 'project-1')).toMatchObject({
      type: 'agent_progress',
      agentId: 'agent-1',
      agentType: 'industry_research_agent',
      displayName: '行业研究',
      progressPercent: 50,
      summary: '已完成 3/5 数据源检索',
      title: '数据检索中',
      eventType: 'source_found',
      skillName: 'company_research',
      visibility: 'public',
      sourceRefs: ['source-1', 'source-2'],
      timestamp: '2026-07-23 14:31:35',
      seq: 2,
    });
  });

  it('accepts MessageVO.metadata as an object or JSON string', () => {
    const messageBase = {
      id: 'message-1',
      conversationId: 'conversation-1',
      projectId: 'project-1',
      agentRunId: 'agent-1',
      role: 'ASSISTANT',
      content: 'Thinking',
      contentType: 'TEXT',
      stage: 'THINKING',
    };
    const objectMetadata = { steps: [{ summary: 'step' }] };
    const stringMetadata = JSON.stringify(objectMetadata);

    expect(
      mapMessageVOToResearchMessage(parseMessageVO({ ...messageBase, metadata: objectMetadata }))
        .metadata,
    ).toEqual(objectMetadata);
    expect(
      mapMessageVOToResearchMessage(parseMessageVO({ ...messageBase, metadata: stringMetadata }))
        .metadata,
    ).toBe(stringMetadata);
  });
});
