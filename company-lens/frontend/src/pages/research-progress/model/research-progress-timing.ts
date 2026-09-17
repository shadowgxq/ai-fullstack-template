/**
 * Perceived total research progress.
 *
 * The API remains authoritative for report readiness. This curve only prevents
 * the page from looking frozen while the real research/report state is pending.
 */
export const RESEARCH_PROGRESS_PHASES = {
  firstPhaseMs: 60_000,
  secondPhaseMs: 4 * 60_000,
  finalPhaseMs: 5 * 60_000,
} as const;

export const REPORT_RETRY_PROGRESS_DURATION_MS = 3 * 60_000;

export type ResearchProgressAgentSnapshot = Readonly<{
  status: string;
  progress?: number;
}>;

function clampProgress(value: number, max = 100): number {
  return Math.min(max, Math.max(0, value));
}

export function getFakeResearchProgress(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  const { firstPhaseMs, secondPhaseMs, finalPhaseMs } = RESEARCH_PROGRESS_PHASES;

  if (elapsed <= firstPhaseMs) {
    return Math.round((elapsed / firstPhaseMs) * 50);
  }

  const secondPhaseEnd = firstPhaseMs + secondPhaseMs;
  if (elapsed <= secondPhaseEnd) {
    return Math.round(50 + ((elapsed - firstPhaseMs) / secondPhaseMs) * 40);
  }

  return Math.min(99, Math.round(90 + ((elapsed - secondPhaseEnd) / finalPhaseMs) * 9));
}

/**
 * Run the final-report retry from its 80% baseline to the report-ready
 * boundary in three minutes. A confirmed report is still the only state that
 * can render 100%.
 */
export function getReportRetryResearchProgress(
  elapsedMs: number,
  baseline = 80,
): number {
  const start = clampProgress(baseline, 99);
  const elapsed = clampProgress(elapsedMs, REPORT_RETRY_PROGRESS_DURATION_MS);
  const progress = start + ((99 - start) * elapsed) / REPORT_RETRY_PROGRESS_DURATION_MS;
  return Math.min(99, Math.round(progress));
}

function getAgentContribution(agent: ResearchProgressAgentSnapshot): number {
  switch (agent.status.trim().toLowerCase()) {
    case 'completed':
    case 'success':
    case 'succeeded':
      return 100;
    case 'running':
      return clampProgress(agent.progress ?? 0, 96);
    default:
      return 0;
  }
}

export function getAgentProgressAverage(agents: readonly ResearchProgressAgentSnapshot[]): number {
  if (agents.length === 0) return 0;
  return agents.reduce((total, agent) => total + getAgentContribution(agent), 0) / agents.length;
}

/**
 * Freeze a terminal failure at the completed-Agent checkpoint.
 *
 * Keep 100% reserved for a confirmed final report, so three completed Agents
 * are represented by 99% instead of falling back to a stale local checkpoint.
 */
export function getFixedFailedResearchProgress(
  agents: readonly ResearchProgressAgentSnapshot[],
): number {
  if (agents.length === 0) return 0;

  const completedAgents = agents.filter((agent) => {
    const status = agent.status.trim().toLowerCase();
    return status === 'completed' || status === 'success' || status === 'succeeded';
  }).length;

  return Math.min(99, Math.round((completedAgents / agents.length) * 99));
}

/**
 * Blend perceived time with real Agent completion without allowing the Agent
 * signal to push the visible progress above the report-ready boundary.
 */
export function getDisplayedResearchProgress(
  timeProgress: number,
  agents: readonly ResearchProgressAgentSnapshot[],
  reportConfirmed: boolean,
): number {
  if (reportConfirmed) return 100;

  const time = clampProgress(Math.round(timeProgress), 99);
  const agentAverage = getAgentProgressAverage(agents);
  const effectiveProgress = Math.max(time, agentAverage);
  return Math.min(99, Math.round(time * 0.65 + effectiveProgress * 0.35));
}
