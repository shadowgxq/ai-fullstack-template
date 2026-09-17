import { describe, expect, it } from 'vitest';

import { ResearchError } from '../../model/research.errors';
import {
  parseMessageVO,
  parsePageResultDto,
  parseProjectVO,
  parseResearchSseEvent,
  parseResultDto,
} from './research.dto';

describe('research DTO validators', () => {
  it('validates the response envelope and keeps null optional data intact', () => {
    expect(parseResultDto({ code: 200, message: null, data: { value: 1 } })).toEqual({
      code: 200,
      message: null,
      data: { value: 1 },
    });
    expect(() => parseResultDto({ code: 200 })).toThrowError(ResearchError);
  });

  it('rejects malformed project, page and message payloads at the API boundary', () => {
    expect(() => parseProjectVO({ id: '1', query: 'x', status: 'RUNNING' })).toThrowError(/agents/);
    expect(() =>
      parsePageResultDto({ total: 1, page: 1, size: 1, records: [null] }, () => {
        throw new ResearchError('contract-invalid', 'bad record');
      }),
    ).toThrowError('bad record');
    expect(() => parseMessageVO({ id: 'message' })).toThrowError(/conversationId/);
  });

  it('normalizes nullable project collections returned during creation', () => {
    expect(
      parseProjectVO({
        id: '1',
        query: 'NVIDIA',
        objectType: 'company',
        status: 'RUNNING',
        agents: null,
        finalists: null,
      }),
    ).toMatchObject({ agents: [], finalists: [] });
  });

  it('validates preflight resolution options returned by a conflicted project', () => {
    expect(
      parseProjectVO({
        id: '1',
        query: 'Tencent',
        status: 'AWAITING_RESOLUTION',
        agents: [],
        finalists: [],
        resolutions: [
          {
            type: 'switch_market',
            market: 'HK',
            resolvedQuery: 'Tencent Holdings',
            label: 'Switch to Hong Kong',
          },
        ],
      }),
    ).toMatchObject({
      resolutions: [
        {
          type: 'switch_market',
          market: 'HK',
          resolvedQuery: 'Tencent Holdings',
        },
      ],
    });
    expect(() =>
      parseProjectVO({
        id: '1',
        query: 'Tencent',
        status: 'AWAITING_RESOLUTION',
        agents: [],
        finalists: [],
        resolutions: 'switch_market',
      }),
    ).toThrowError(/resolutions/);
  });

  it('requires pagination metadata to be integral and within its supported bounds', () => {
    const parseEmptyPage = (value: unknown) => parsePageResultDto(value, () => 'record');

    expect(() => parseEmptyPage({ total: -1, page: 1, size: 1, records: [] })).toThrowError(
      /total must be a non-negative integer/,
    );
    expect(() => parseEmptyPage({ total: 1, page: 1.5, size: 1, records: [] })).toThrowError(
      /page must be a non-negative integer/,
    );
    expect(() => parseEmptyPage({ total: 1, page: 0, size: 1, records: [] })).toThrowError(
      /page must be a positive integer/,
    );
    expect(() => parseEmptyPage({ total: 1, page: 1, size: 0, records: [] })).toThrowError(
      /size must be a positive integer/,
    );
  });

  it('validates all frozen SSE event families and special sequence values', () => {
    expect(parseResearchSseEvent('heartbeat', { seq: 0 })).toMatchObject({ event: 'heartbeat' });
    expect(
      parseResearchSseEvent('agent_progress', {
        seq: 8,
        projectId: 'project-1',
        agentRunId: 'agent-1',
        agentName: 'quality_screen',
        progress: 55,
      }),
    ).toMatchObject({ event: 'agent_progress' });
    expect(
      parseResearchSseEvent('agent_completed', {
        seq: 9,
        projectId: 'project-1',
        agentRunId: 'agent-1',
        agentName: 'quality_screen',
        progress: 100,
      }),
    ).toMatchObject({ event: 'agent_completed', data: { seq: 9, agentRunId: 'agent-1' } });
    expect(
      parseResearchSseEvent('workflow_completed', {
        seq: 10,
        projectId: 'project-1',
      }),
    ).toMatchObject({ event: 'workflow_completed', data: { seq: 10 } });
    expect(() => parseResearchSseEvent('done', { seq: 0 })).toThrowError(/done.seq must be -1/);
    expect(() => parseResearchSseEvent('new_event', { seq: 1 })).toThrowError(/Unsupported/);
  });
});
