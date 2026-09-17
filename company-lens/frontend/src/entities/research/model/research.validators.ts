import { MAX_CONCURRENT_RESEARCH_AGENTS } from './research.constants';
import type {
  ResearchContractIssue,
  ResearchProjectSnapshot,
  ResearchAgentProgress,
} from './research.types';

function countRunningAgents(agentTasks: readonly ResearchAgentProgress[]): number {
  return agentTasks.filter((agent) => agent.status === 'running').length;
}

/**
 * 共享 read-model 诊断只报告服务端事实异常，不修正 Agent 状态；否则 UI 会把契约问题伪装成正常调度。
 */
export function getResearchSnapshotContractIssues(
  snapshot: ResearchProjectSnapshot,
): readonly ResearchContractIssue[] {
  const issues: ResearchContractIssue[] = [];
  const runningCount = countRunningAgents(snapshot.progress.agentTasks);

  if (runningCount > MAX_CONCURRENT_RESEARCH_AGENTS) {
    issues.push({
      code: 'running-agent-limit-exceeded',
      message: `Project ${snapshot.project.projectId} has ${runningCount} running agents; the contract limit is ${MAX_CONCURRENT_RESEARCH_AGENTS}.`,
      projectId: snapshot.project.projectId,
      details: { runningCount, maxConcurrent: MAX_CONCURRENT_RESEARCH_AGENTS },
    });
  }

  if (snapshot.result.resultCompleteness === 'full' && snapshot.result.resultReady !== true) {
    issues.push({
      code: 'snapshot-inconsistent',
      message: 'A full result must be explicitly ready.',
      projectId: snapshot.project.projectId,
    });
  }

  return issues;
}

export function assertResearchSnapshot(snapshot: ResearchProjectSnapshot): void {
  const issues = getResearchSnapshotContractIssues(snapshot);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join('; '));
  }
}

export function isProgressPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}
