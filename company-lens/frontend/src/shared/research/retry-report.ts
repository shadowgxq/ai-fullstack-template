export type RetryReportAgentState = Readonly<{
  name?: string;
  agentName?: string;
  status: string;
}>;

export type RetryReportEligibilityInput = Readonly<{
  status: string;
  agents?: readonly RetryReportAgentState[];
  capabilities?: readonly RetryReportAgentState[];
  finalResultAvailable?: boolean;
  synthesisFailed?: boolean;
}>;

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}

function isSynthesisState(state: RetryReportAgentState): boolean {
  const name = (state.name ?? state.agentName ?? '').trim().toLowerCase();
  return name.includes('synthesis') || name.includes('decision_aggregator');
}

/**
 * 详情优先使用 agents[]；历史列表没有 agents[] 时使用 capabilities[]。
 * V2.0 约定这两个数组都表示三个顶层研究 Agent；synthesis 由
 * synthesisFailed 单独标记。兼容旧版前端模型中把 synthesis 作为第四个
 * capabilities 条目返回的情况，避免把 synthesis 阶段本身误判成失败 Agent。
 */
export function getRetryReportAgentStates(
  agents?: readonly RetryReportAgentState[],
  capabilities?: readonly RetryReportAgentState[],
): readonly RetryReportAgentState[] {
  const source = agents && agents.length > 0 ? agents : (capabilities ?? []);
  return source.filter((state) => !isSynthesisState(state));
}

export function canRetryFinalReport(input: RetryReportEligibilityInput): boolean {
  const agentStates = getRetryReportAgentStates(input.agents, input.capabilities);
  return (
    normalizeStatus(input.status) === 'FAILED' &&
    agentStates.length > 0 &&
    agentStates.every((state) => normalizeStatus(state.status) === 'SUCCEEDED') &&
    input.finalResultAvailable === false &&
    input.synthesisFailed === true
  );
}
