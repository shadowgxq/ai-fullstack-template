export const RESEARCH_OBJECT_TYPES = ['industry', 'theme', 'company', 'unknown'] as const;

export const RESEARCH_PROJECT_STATUSES = [
  'waiting',
  'running',
  'completed',
  'failed',
  'cancelled',
  'unknown',
] as const;

export const RESEARCH_AGENT_STATUSES = [
  'waiting',
  'running',
  'completed',
  'failed',
  'cancelled',
  'unknown',
] as const;

export const RESEARCH_REPORT_STATUSES = ['available', 'unavailable', 'unknown'] as const;

export const RESEARCH_RESULT_COMPLETENESS = ['full', 'partial', 'unavailable'] as const;

export const RESEARCH_MESSAGE_STAGES = [
  'THINKING',
  'REPORT',
  'CITATION',
  'APPENDIX',
  'ATTACHMENT',
  'unknown',
] as const;

export const RESEARCH_EVIDENCE_CATEGORIES = [
  'fact',
  'analysis',
  'risk-to-verify',
  'source',
  'unknown',
] as const;

/** 产品当前的五个 Agent 标识，仅用于 fixture 覆盖和展示顺序，不描述服务端调度依赖。 */
export const RESEARCH_AGENT_TYPES = [
  'industry_research',
  'bottleneck_hunter',
  'quality_screen',
  'industry_funnel',
  'investment_checklist',
] as const;

/** 同一研究项目允许同时运行的 Agent 上限，Mock 和诊断校验必须引用这一处。 */
export const MAX_CONCURRENT_RESEARCH_AGENTS = 3;
