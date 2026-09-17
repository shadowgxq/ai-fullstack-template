import { describe, expect, it } from 'vitest';

import { MOCK_RESEARCH_SCENARIOS } from '../testing/research-fixtures';
import { getResearchSnapshotContractIssues } from './research.validators';

describe('research read-model validators', () => {
  it('reports concurrency violations without changing the server read model', () => {
    const source = MOCK_RESEARCH_SCENARIOS[0].timeline[0].snapshot;
    const agentTasks = source.progress.agentTasks.map((agent) => ({
      ...agent,
      status: 'running' as const,
    }));
    const overloaded = {
      ...source,
      progress: { ...source.progress, agentTasks },
    };

    const issues = getResearchSnapshotContractIssues(overloaded);
    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'running-agent-limit-exceeded' })]),
    );
    expect(overloaded.progress.agentTasks.every((agent) => agent.status === 'running')).toBe(true);
  });

  it('does not treat unknown or unavailable results as ready', () => {
    const source = MOCK_RESEARCH_SCENARIOS[3].timeline[0].snapshot;
    expect(source.result.resultCompleteness).toBe('unavailable');
    expect(source.result.resultReady).toBe(false);
    expect(getResearchSnapshotContractIssues(source)).toEqual([]);
  });
});
