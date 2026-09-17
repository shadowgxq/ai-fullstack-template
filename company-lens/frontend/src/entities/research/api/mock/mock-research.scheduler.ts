import { ResearchError } from '../../model/research.errors';
import type { ResearchProjectSnapshot } from '../../model/research.types';
import { assertMockScenario, assertMockSnapshot } from '../../testing/research-fixture-validator';
import type { MockResearchScenario, MockTimelinePoint } from './mock-research.types';

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type MockSnapshotListener = (
  snapshot: ResearchProjectSnapshot,
  previousSnapshot?: ResearchProjectSnapshot,
) => void;

export type MockResearchSchedulerOptions = {
  now?: () => number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
};

type ScenarioRuntime = {
  scenario: MockResearchScenario;
  phase: 'initial' | 'retry';
  timeline: readonly MockTimelinePoint[];
  startedAt: number;
  pointIndex: number;
  snapshot: ResearchProjectSnapshot;
  timer?: TimerHandle;
  listeners: Set<MockSnapshotListener>;
};

function copySnapshot(snapshot: ResearchProjectSnapshot): ResearchProjectSnapshot {
  return {
    ...snapshot,
    project: { ...snapshot.project },
    progress: {
      ...snapshot.progress,
      agentTasks: snapshot.progress.agentTasks.map((agent) => ({ ...agent })),
      ...(snapshot.progress.failedAgentTypes
        ? { failedAgentTypes: [...snapshot.progress.failedAgentTypes] }
        : {}),
    },
    result: {
      ...snapshot.result,
      ...(snapshot.result.finalists
        ? { finalists: snapshot.result.finalists.map((finalist) => ({ ...finalist })) }
        : {}),
      ...(snapshot.result.missingReports
        ? { missingReports: [...snapshot.result.missingReports] }
        : {}),
      ...(snapshot.result.evidenceGaps ? { evidenceGaps: [...snapshot.result.evidenceGaps] } : {}),
      ...(snapshot.result.limitations ? { limitations: [...snapshot.result.limitations] } : {}),
    },
    ...(snapshot.contractIssues
      ? { contractIssues: snapshot.contractIssues.map((item) => ({ ...item })) }
      : {}),
  };
}

/**
 * Mock scheduler 只推进 fixture 已声明的快照。
 * 它把 timer 放在 repository 生命周期内，因此页面卸载不会取消或重置研究项目。
 */
export class MockResearchScheduler {
  private readonly now: () => number;

  private readonly scheduleTimeout: typeof globalThis.setTimeout;

  private readonly cancelTimeout: typeof globalThis.clearTimeout;

  private readonly runtimes = new Map<string, ScenarioRuntime>();

  constructor(
    scenarios: readonly MockResearchScenario[],
    options: MockResearchSchedulerOptions = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.scheduleTimeout = options.setTimeout ?? globalThis.setTimeout.bind(globalThis);
    this.cancelTimeout = options.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);

    scenarios.forEach((scenario) => this.registerScenario(scenario));
  }

  registerScenario(scenario: MockResearchScenario): void {
    assertMockScenario(scenario);
    const firstPoint = scenario.timeline[0];
    if (!firstPoint) {
      throw new ResearchError(
        'contract-invalid',
        `Scenario ${scenario.scenarioId} has no initial snapshot.`,
      );
    }
    assertMockSnapshot(scenario, firstPoint.snapshot);
    const runtime: ScenarioRuntime = {
      scenario,
      phase: 'initial',
      timeline: scenario.timeline,
      startedAt: this.now(),
      pointIndex: 0,
      snapshot: copySnapshot(firstPoint.snapshot),
      listeners: new Set(),
    };
    this.runtimes.set(scenario.projectId, runtime);
    this.scheduleNext(runtime);
  }

  getSnapshot(projectId: string): ResearchProjectSnapshot {
    const runtime = this.getRuntime(projectId);
    this.sync(runtime);
    return copySnapshot(runtime.snapshot);
  }

  getScenario(projectId: string): MockResearchScenario {
    return this.getRuntime(projectId).scenario;
  }

  subscribe(projectId: string, listener: MockSnapshotListener): { unsubscribe: () => void } {
    const runtime = this.getRuntime(projectId);
    this.sync(runtime);
    runtime.listeners.add(listener);
    listener(copySnapshot(runtime.snapshot));
    return {
      unsubscribe: () => {
        runtime.listeners.delete(listener);
      },
    };
  }

  retry(projectId: string, agentType: string): ResearchProjectSnapshot {
    const runtime = this.getRuntime(projectId);
    this.sync(runtime);
    if (!runtime.scenario.retry || runtime.scenario.retry.agentType !== agentType) {
      throw new ResearchError(
        'retry-not-allowed',
        `Agent ${agentType} cannot be retried in ${projectId}.`,
      );
    }
    const agent = runtime.snapshot.progress.agentTasks.find(
      (candidate) => candidate.agentType === agentType,
    );
    if (!agent || agent.status !== 'failed') {
      throw new ResearchError(
        'retry-not-allowed',
        `Agent ${agentType} is not failed in ${projectId}.`,
      );
    }

    const previousSnapshot = runtime.snapshot;
    const retryTimeline = runtime.scenario.retry.timeline;
    const firstPoint = retryTimeline[0];
    if (!firstPoint) {
      throw new ResearchError('contract-invalid', `Retry timeline for ${projectId} is empty.`);
    }
    const nextSnapshot = copySnapshot(firstPoint.snapshot);
    assertMockSnapshot(
      runtime.scenario,
      nextSnapshot,
      previousSnapshot.progress.agentTasks.map((agentItem) => agentItem.agentId),
    );

    runtime.phase = 'retry';
    runtime.timeline = retryTimeline;
    runtime.startedAt = this.now();
    runtime.pointIndex = 0;
    runtime.snapshot = nextSnapshot;
    this.notify(runtime, runtime.snapshot, previousSnapshot);
    this.scheduleNext(runtime);
    return copySnapshot(runtime.snapshot);
  }

  destroy(): void {
    for (const runtime of this.runtimes.values()) {
      if (runtime.timer !== undefined) {
        this.cancelTimeout(runtime.timer);
      }
      runtime.listeners.clear();
    }
    this.runtimes.clear();
  }

  private getRuntime(projectId: string): ScenarioRuntime {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) {
      throw new ResearchError('not-found', `Research project ${projectId} was not found.`);
    }
    return runtime;
  }

  private sync(runtime: ScenarioRuntime): void {
    const elapsedMs = Math.max(0, this.now() - runtime.startedAt);
    let nextPointIndex = runtime.pointIndex;
    while (
      nextPointIndex + 1 < runtime.timeline.length &&
      runtime.timeline[nextPointIndex + 1].afterMs <= elapsedMs
    ) {
      nextPointIndex += 1;
    }
    if (nextPointIndex === runtime.pointIndex) {
      return;
    }

    const nextSnapshot = copySnapshot(runtime.timeline[nextPointIndex].snapshot);
    assertMockSnapshot(
      runtime.scenario,
      nextSnapshot,
      runtime.snapshot.progress.agentTasks.map((agentItem) => agentItem.agentId),
    );
    const previousSnapshot = runtime.snapshot;
    runtime.pointIndex = nextPointIndex;
    runtime.snapshot = nextSnapshot;
    this.notify(runtime, runtime.snapshot, previousSnapshot);
    this.scheduleNext(runtime);
  }

  private scheduleNext(runtime: ScenarioRuntime): void {
    if (runtime.timer !== undefined) {
      this.cancelTimeout(runtime.timer);
      runtime.timer = undefined;
    }

    const nextPoint = runtime.timeline[runtime.pointIndex + 1];
    if (!nextPoint) {
      return;
    }
    const elapsedMs = Math.max(0, this.now() - runtime.startedAt);
    const delayMs = Math.max(0, nextPoint.afterMs - elapsedMs);
    runtime.timer = this.scheduleTimeout(() => {
      runtime.timer = undefined;
      this.sync(runtime);
    }, delayMs);
  }

  private notify(
    runtime: ScenarioRuntime,
    snapshot: ResearchProjectSnapshot,
    previousSnapshot: ResearchProjectSnapshot,
  ): void {
    for (const listener of runtime.listeners) {
      listener(copySnapshot(snapshot), copySnapshot(previousSnapshot));
    }
  }
}
