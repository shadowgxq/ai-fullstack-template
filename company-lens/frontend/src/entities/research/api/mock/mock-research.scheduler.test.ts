import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOCK_RESEARCH_SCENARIOS } from '../../testing/research-fixtures';
import { MockResearchScheduler } from './mock-research.scheduler';

describe('MockResearchScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('continues a project timeline after the consumer unsubscribes', () => {
    vi.useFakeTimers();
    const scenario = MOCK_RESEARCH_SCENARIOS[0];
    const scheduler = new MockResearchScheduler([scenario]);
    const listener = vi.fn();
    const subscription = scheduler.subscribe(scenario.projectId, listener);

    expect(scheduler.getSnapshot(scenario.projectId).progress.progressPercent).toBe(18);
    expect(listener).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    vi.advanceTimersByTime(2400);

    const snapshot = scheduler.getSnapshot(scenario.projectId);
    expect(snapshot.result.resultCompleteness).toBe('full');
    expect(snapshot.progress.agentTasks.every((agent) => agent.status === 'completed')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    scheduler.destroy();
  });

  it('moves the same project into the declared retry timeline', () => {
    vi.useFakeTimers();
    const scenario = MOCK_RESEARCH_SCENARIOS[4];
    const scheduler = new MockResearchScheduler([scenario]);
    const failedAgent = scenario.retry?.agentType;

    expect(failedAgent).toBeDefined();
    expect(scheduler.getSnapshot(scenario.projectId).progress.agentTasks[1].status).toBe('failed');

    const retrySnapshot = scheduler.retry(scenario.projectId, failedAgent ?? '');
    expect(retrySnapshot.project.projectId).toBe(scenario.projectId);
    expect(retrySnapshot.progress.agentTasks[1].status).toBe('running');

    vi.advanceTimersByTime(1400);
    expect(scheduler.getSnapshot(scenario.projectId).result.resultCompleteness).toBe('full');
    scheduler.destroy();
  });

  it('rejects retry for a non-failed or unknown agent', () => {
    const scenario = MOCK_RESEARCH_SCENARIOS[0];
    const scheduler = new MockResearchScheduler([scenario]);

    expect(() => scheduler.retry(scenario.projectId, 'unknown-agent')).toThrowError(
      /cannot be retried/,
    );
    scheduler.destroy();
  });
});
