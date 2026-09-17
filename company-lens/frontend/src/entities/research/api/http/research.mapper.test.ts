import { describe, expect, it } from 'vitest';

import type { ProjectVO } from './research.dto';
import {
  mapMessageVOToResearchMessage,
  mapProjectVOToSnapshot,
  mapResearchSseEvent,
} from './research.mapper';

const baseProject: ProjectVO = {
  id: '2074001493837324210',
  query: 'AI 算力',
  objectType: 'THEME',
  market: 'GLOBAL',
  status: 'SUCCEEDED',
  resolutions: [],
  agents: [
    {
      id: '2074001493837324211',
      agentName: 'industry_research',
      status: 'SUCCEEDED',
      seq: 1,
    },
  ],
  finalists: [{ companyName: 'Example', ticker: 'EX' }],
};

describe('research API mapper', () => {
  it('keeps long IDs as strings and maps full results without inventing optional fields', () => {
    const snapshot = mapProjectVOToSnapshot(baseProject);

    expect(snapshot.project.projectId).toBe('2074001493837324210');
    expect(snapshot.result.resultCompleteness).toBe('full');
    expect(snapshot.result.resultReady).toBe(true);
    expect(snapshot.result.confidence).toBeUndefined();
    expect(snapshot.result.qualityScore).toBeUndefined();
    expect(snapshot.result.finalists?.[0]).not.toHaveProperty('companyId');
  });

  it('maps unknown statuses and markets to non-success fallbacks with raw values', () => {
    const snapshot = mapProjectVOToSnapshot({
      ...baseProject,
      market: 'GLOBAL',
      status: 'SERVER_ADDED_STATUS',
      agents: [{ ...baseProject.agents[0], status: 'SERVER_AGENT_STATUS' }],
    });

    expect(snapshot.project.market).toBe('unknown');
    expect(snapshot.project.rawMarket).toBe('GLOBAL');
    expect(snapshot.project.status).toBe('unknown');
    expect(snapshot.project.rawStatus).toBe('SERVER_ADDED_STATUS');
    expect(snapshot.result.resultReady).toBe(false);
    expect(snapshot.progress.agentTasks[0].status).toBe('unknown');
    expect(snapshot.progress.agentTasks[0].canRetry).toBe(false);
  });

  it('does not expose a result while the project is still running', () => {
    const snapshot = mapProjectVOToSnapshot({
      ...baseProject,
      status: 'RUNNING',
      resultReady: true,
      resultCompleteness: 1,
    });

    expect(snapshot.progress).toMatchObject({
      status: 'running',
      resultReady: false,
      resultCompleteness: 'unavailable',
    });
    expect(snapshot.result).toMatchObject({
      resultReady: false,
      resultCompleteness: 'unavailable',
    });
  });

  it('normalizes lowercase object types returned by the live create endpoint', () => {
    expect(
      mapProjectVOToSnapshot({ ...baseProject, objectType: 'company' }).project.objectType,
    ).toBe('company');
  });

  it('maps a preflight conflict and its server-provided resolution options', () => {
    const project = mapProjectVOToSnapshot({
      ...baseProject,
      status: 'AWAITING_RESOLUTION',
      preflightStatus: 'CONFLICT',
      preflightMessage: 'Market mismatch',
      resolutions: [
        {
          type: 'switch_market',
          market: 'HK',
          resolvedQuery: 'Tencent Holdings',
          label: 'Switch to Hong Kong',
        },
      ],
    }).project;

    expect(project).toMatchObject({
      status: 'waiting',
      requiresResolution: true,
      preflightStatus: 'CONFLICT',
      preflightMessage: 'Market mismatch',
      preflightResolutions: [
        {
          type: 'switch_market',
          market: 'HK',
          resolvedQuery: 'Tencent Holdings',
          label: 'Switch to Hong Kong',
        },
      ],
    });
  });

  it('keeps message sequence separate from event cursor and preserves unknown raw fields', () => {
    const message = mapMessageVOToResearchMessage({
      id: 'message-1',
      conversationId: 'conversation-1',
      projectId: baseProject.id,
      agentRunId: baseProject.agents[0].id,
      role: 'NEW_ROLE',
      content: 'report',
      contentType: 'NEW_CONTENT_TYPE',
      stage: 'REPORT',
      seq: 42,
    });

    expect(message.messageSequence).toBe(42);
    expect(message.rawRole).toBe('NEW_ROLE');
    expect(message.rawContentType).toBe('NEW_CONTENT_TYPE');
    expect(message.stage).toBe('REPORT');
  });

  it('maps special SSE sequence values without turning them into cursors', () => {
    expect(mapResearchSseEvent({ event: 'heartbeat', data: { seq: 0 } }, baseProject.id)).toEqual({
      type: 'heartbeat',
      seq: 0,
    });
    expect(
      mapResearchSseEvent(
        { event: 'done', data: { seq: -1, projectId: baseProject.id } },
        baseProject.id,
      ),
    ).toMatchObject({ type: 'done', seq: -1, projectId: baseProject.id });
    expect(() =>
      mapResearchSseEvent(
        { event: 'done', data: { seq: -1, projectId: 'another-project' } },
        baseProject.id,
      ),
    ).toThrowError(/does not match subscription/);
  });

  it('maps completion SSE events with their project cursor and resource identity', () => {
    expect(
      mapResearchSseEvent(
        {
          event: 'agent_completed',
          data: {
            seq: 9,
            projectId: baseProject.id,
            agentRunId: baseProject.agents[0].id,
            agentName: baseProject.agents[0].agentName,
            progress: 100,
          },
        },
        baseProject.id,
      ),
    ).toMatchObject({
      type: 'agent_completed',
      seq: 9,
      agentId: baseProject.agents[0].id,
      progressPercent: 100,
    });
    expect(
      mapResearchSseEvent(
        {
          event: 'workflow_completed',
          data: { seq: 10, projectId: baseProject.id },
        },
        baseProject.id,
      ),
    ).toEqual({ type: 'workflow_completed', seq: 10, projectId: baseProject.id });
  });
});
