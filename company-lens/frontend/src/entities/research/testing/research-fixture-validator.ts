import { MAX_CONCURRENT_RESEARCH_AGENTS, RESEARCH_AGENT_TYPES } from '../model/research.constants';
import { ResearchError } from '../model/research.errors';
import type { ResearchProjectSnapshot } from '../model/research.types';
import type { MockResearchScenario, MockTimelinePoint } from '../api/mock/mock-research.types';

export type MockFixtureIssue = {
  code:
    | 'missing-timeline'
    | 'invalid-timeline'
    | 'project-id-mismatch'
    | 'agent-matrix-invalid'
    | 'running-agent-limit-exceeded'
    | 'result-state-invalid'
    | 'retry-timeline-invalid'
    | 'suite-coverage-missing';
  message: string;
  scenarioId?: string;
};

function issue(
  code: MockFixtureIssue['code'],
  message: string,
  scenarioId?: string,
): MockFixtureIssue {
  return { code, message, ...(scenarioId ? { scenarioId } : {}) };
}

function getAgents(snapshot: ResearchProjectSnapshot) {
  return snapshot.progress.agentTasks;
}

function validateSnapshot(
  scenario: MockResearchScenario,
  point: MockTimelinePoint,
  expectedAgentIds: readonly string[] | undefined,
): MockFixtureIssue[] {
  const issues: MockFixtureIssue[] = [];
  const snapshot = point.snapshot;
  const agents = getAgents(snapshot);

  if (
    snapshot.project.projectId !== scenario.projectId ||
    snapshot.progress.projectId !== scenario.projectId ||
    snapshot.result.projectId !== scenario.projectId
  ) {
    issues.push(
      issue(
        'project-id-mismatch',
        'project, progress and result must use the scenario projectId.',
        scenario.scenarioId,
      ),
    );
  }

  if (agents.length !== RESEARCH_AGENT_TYPES.length) {
    issues.push(
      issue(
        'agent-matrix-invalid',
        `Expected exactly ${RESEARCH_AGENT_TYPES.length} agents, got ${agents.length}.`,
        scenario.scenarioId,
      ),
    );
  }

  agents.forEach((agent, index) => {
    if (expectedAgentIds?.[index] && expectedAgentIds[index] !== agent.agentId) {
      issues.push(
        issue(
          'agent-matrix-invalid',
          `Agent ${index + 1} changed identity between snapshots.`,
          scenario.scenarioId,
        ),
      );
    }
    if (agent.agentType !== RESEARCH_AGENT_TYPES[index]) {
      issues.push(
        issue(
          'agent-matrix-invalid',
          `Agent ${index + 1} must keep the stable type ${RESEARCH_AGENT_TYPES[index]}.`,
          scenario.scenarioId,
        ),
      );
    }
  });

  const runningCount = agents.filter((agent) => agent.status === 'running').length;
  if (runningCount > MAX_CONCURRENT_RESEARCH_AGENTS) {
    issues.push(
      issue(
        'running-agent-limit-exceeded',
        `Snapshot contains ${runningCount} running agents; the limit is ${MAX_CONCURRENT_RESEARCH_AGENTS}.`,
        scenario.scenarioId,
      ),
    );
  }

  const { resultCompleteness, resultReady } = snapshot.result;
  if (
    (resultCompleteness === 'unavailable' && resultReady) ||
    (resultCompleteness !== 'unavailable' && !resultReady)
  ) {
    issues.push(
      issue(
        'result-state-invalid',
        'resultReady must agree with resultCompleteness without deriving business data.',
        scenario.scenarioId,
      ),
    );
  }

  if (point.afterMs < 0) {
    issues.push(
      issue('invalid-timeline', 'Timeline offsets cannot be negative.', scenario.scenarioId),
    );
  }

  return issues;
}

function validateTimeline(
  scenario: MockResearchScenario,
  timeline: readonly MockTimelinePoint[],
  expectedAgentIds?: readonly string[],
): MockFixtureIssue[] {
  if (timeline.length === 0) {
    return [
      issue(
        'missing-timeline',
        'Scenario must contain at least one timeline point.',
        scenario.scenarioId,
      ),
    ];
  }

  const issues: MockFixtureIssue[] = [];
  let previousAfterMs = -1;
  for (const point of timeline) {
    if (point.afterMs < previousAfterMs) {
      issues.push(
        issue(
          'invalid-timeline',
          'Timeline offsets must be monotonically increasing.',
          scenario.scenarioId,
        ),
      );
    }
    previousAfterMs = point.afterMs;
    issues.push(...validateSnapshot(scenario, point, expectedAgentIds));
  }
  return issues;
}

export function validateMockScenario(scenario: MockResearchScenario): readonly MockFixtureIssue[] {
  const firstPoint = scenario.timeline[0];
  const expectedAgentIds = firstPoint?.snapshot.progress.agentTasks.map((agent) => agent.agentId);
  const issues = validateTimeline(scenario, scenario.timeline, expectedAgentIds);

  if (scenario.retry) {
    const failedInInitialTimeline = scenario.timeline.some((point) =>
      point.snapshot.progress.agentTasks.some(
        (agent) => agent.agentType === scenario.retry?.agentType && agent.status === 'failed',
      ),
    );
    const retryHasRunningAgent = scenario.retry.timeline.some((point) =>
      point.snapshot.progress.agentTasks.some(
        (agent) => agent.agentType === scenario.retry?.agentType && agent.status === 'running',
      ),
    );
    if (!failedInInitialTimeline || !retryHasRunningAgent) {
      issues.push(
        issue(
          'retry-timeline-invalid',
          'A retry timeline must be reachable from a failed agent and move that agent to running.',
          scenario.scenarioId,
        ),
      );
    }
    issues.push(...validateTimeline(scenario, scenario.retry.timeline, expectedAgentIds));
  }

  return issues;
}

export function assertMockScenario(scenario: MockResearchScenario): void {
  const issues = validateMockScenario(scenario);
  if (issues.length > 0) {
    throw new ResearchError('contract-invalid', issues.map((item) => item.message).join('; '), {
      details: issues,
    });
  }
}

export function validateMockSnapshot(
  scenario: MockResearchScenario,
  snapshot: ResearchProjectSnapshot,
  expectedAgentIds?: readonly string[],
): readonly MockFixtureIssue[] {
  return validateSnapshot(scenario, { afterMs: 0, snapshot }, expectedAgentIds);
}

export function assertMockSnapshot(
  scenario: MockResearchScenario,
  snapshot: ResearchProjectSnapshot,
  expectedAgentIds?: readonly string[],
): void {
  const issues = validateMockSnapshot(scenario, snapshot, expectedAgentIds);
  if (issues.length > 0) {
    throw new ResearchError('contract-invalid', issues.map((item) => item.message).join('; '), {
      details: issues,
    });
  }
}

export function validateMockFixtureSuite(
  scenarios: readonly MockResearchScenario[],
): readonly MockFixtureIssue[] {
  const issues = scenarios.flatMap((scenario) => validateMockScenario(scenario));
  const objectTypes = new Set(scenarios.map((scenario) => scenario.objectType));
  const markets = new Set(scenarios.map((scenario) => scenario.market));
  const agentStatuses = new Set(
    scenarios.flatMap((scenario) =>
      [...scenario.timeline, ...(scenario.retry?.timeline ?? [])].flatMap((point) =>
        point.snapshot.progress.agentTasks.map((agent) => agent.status),
      ),
    ),
  );
  const resultStates = new Set(
    scenarios.flatMap((scenario) =>
      [...scenario.timeline, ...(scenario.retry?.timeline ?? [])].map(
        (point) => point.snapshot.result.resultCompleteness,
      ),
    ),
  );
  const reportStates = new Set(
    scenarios.flatMap((scenario) =>
      Object.values(scenario.reports).map((report) => report.reportStatus),
    ),
  );

  const requiredObjectTypes = ['industry', 'theme', 'company'] as const;
  for (const objectType of requiredObjectTypes) {
    if (!objectTypes.has(objectType)) {
      issues.push(issue('suite-coverage-missing', `Missing object type coverage: ${objectType}.`));
    }
  }
  for (const market of ['US', 'CN', 'HK', 'JP', 'KR'] as const) {
    if (!markets.has(market)) {
      issues.push(issue('suite-coverage-missing', `Missing market coverage: ${market}.`));
    }
  }
  for (const status of ['waiting', 'running', 'completed', 'failed'] as const) {
    if (!agentStatuses.has(status)) {
      issues.push(issue('suite-coverage-missing', `Missing Agent status coverage: ${status}.`));
    }
  }
  for (const completeness of ['full', 'partial', 'unavailable'] as const) {
    if (!resultStates.has(completeness)) {
      issues.push(
        issue('suite-coverage-missing', `Missing result completeness coverage: ${completeness}.`),
      );
    }
  }
  for (const reportStatus of ['available', 'unavailable'] as const) {
    if (!reportStates.has(reportStatus)) {
      issues.push(
        issue('suite-coverage-missing', `Missing report status coverage: ${reportStatus}.`),
      );
    }
  }
  if (!scenarios.some((scenario) => scenario.coverage.hasFailureBlockedState)) {
    issues.push(issue('suite-coverage-missing', 'Missing failure-blocked scenario coverage.'));
  }
  if (!scenarios.some((scenario) => scenario.coverage.hasRetryProgression && scenario.retry)) {
    issues.push(issue('suite-coverage-missing', 'Missing retry progression coverage.'));
  }
  if (!scenarios.some((scenario) => scenario.coverage.supportsReentry)) {
    issues.push(issue('suite-coverage-missing', 'Missing re-entry persistence coverage.'));
  }
  if (!scenarios.some((scenario) => scenario.coverage.hasLongContent)) {
    issues.push(issue('suite-coverage-missing', 'Missing long-content fixture coverage.'));
  }
  if (!scenarios.some((scenario) => scenario.coverage.hasMissingOptionalFields)) {
    issues.push(issue('suite-coverage-missing', 'Missing optional-field omission coverage.'));
  }

  return issues;
}

export function assertMockFixtureSuite(scenarios: readonly MockResearchScenario[]): void {
  const issues = validateMockFixtureSuite(scenarios);
  if (issues.length > 0) {
    throw new ResearchError('contract-invalid', issues.map((item) => item.message).join('; '), {
      details: issues,
    });
  }
}
