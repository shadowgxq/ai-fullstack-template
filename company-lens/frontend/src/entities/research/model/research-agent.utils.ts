export function normalizeResearchAgentType(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/^agent\./, '')
    .replace(/_agent$/, '');
}

export function isDecisionAggregatorAgentType(value: string): boolean {
  return normalizeResearchAgentType(value) === 'decision_aggregator';
}
