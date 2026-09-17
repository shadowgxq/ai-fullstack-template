export type AgentReportLocationState = Readonly<{
  returnTo?: unknown;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getAgentReportReturnPath(state: unknown, fallbackPath: string): string {
  const returnTo = isRecord(state) && typeof state.returnTo === 'string' ? state.returnTo : undefined;
  return returnTo?.startsWith('/research/') ? returnTo : fallbackPath;
}
