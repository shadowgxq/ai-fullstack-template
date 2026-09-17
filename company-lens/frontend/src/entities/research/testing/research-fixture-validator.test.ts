import { describe, expect, it } from 'vitest';

import { RESEARCH_AGENT_TYPES } from '../model/research.constants';
import { MOCK_RESEARCH_SCENARIOS } from './research-fixtures';
import {
  assertMockFixtureSuite,
  validateMockFixtureSuite,
  validateMockScenario,
} from './research-fixture-validator';

describe('research fixture suite', () => {
  it('covers the required product matrix and validates at module load', () => {
    expect(validateMockFixtureSuite(MOCK_RESEARCH_SCENARIOS)).toEqual([]);
    expect(() => assertMockFixtureSuite(MOCK_RESEARCH_SCENARIOS)).not.toThrow();
    expect(MOCK_RESEARCH_SCENARIOS).toHaveLength(5);

    const partialResult = MOCK_RESEARCH_SCENARIOS[2].timeline[0].snapshot.result;
    expect(partialResult).toMatchObject({
      resultCompleteness: 'partial',
      missingReports: ['quality_screen', 'investment_checklist'],
    });
    expect(partialResult.evidenceGaps).toHaveLength(2);
    expect(partialResult.limitations).toHaveLength(2);
    expect(partialResult.maxRisk).toContain('不应将该风险压缩为单一指标');
    expect(partialResult.finalists?.[0]?.reason).toContain('不能被解释为对其他公司的替代推荐');
  });

  it('rejects a snapshot that exceeds the concurrency contract without rewriting it', () => {
    const source = MOCK_RESEARCH_SCENARIOS[0];
    const point = source.timeline[0];
    const agentTasks = point.snapshot.progress.agentTasks.map((agent, index) =>
      index === 3 ? { ...agent, status: 'running' as const } : agent,
    );
    const invalidScenario = {
      ...source,
      timeline: [
        {
          ...point,
          snapshot: {
            ...point.snapshot,
            progress: { ...point.snapshot.progress, agentTasks },
          },
        },
      ],
    };

    const issues = validateMockScenario(invalidScenario);
    expect(issues.some((issue) => issue.code === 'running-agent-limit-exceeded')).toBe(true);
    expect(invalidScenario.timeline[0].snapshot.progress.agentTasks[3].status).toBe('running');
    expect(RESEARCH_AGENT_TYPES).toHaveLength(5);
  });

  it('keeps the stable Agent identity and order across retry snapshots', () => {
    for (const scenario of MOCK_RESEARCH_SCENARIOS) {
      const initialIds = scenario.timeline[0].snapshot.progress.agentTasks.map(
        (agent) => agent.agentId,
      );
      for (const point of scenario.retry?.timeline ?? []) {
        expect(point.snapshot.progress.agentTasks.map((agent) => agent.agentId)).toEqual(
          initialIds,
        );
      }
    }
  });
});
