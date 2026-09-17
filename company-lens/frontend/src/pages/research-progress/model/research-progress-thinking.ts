import type {
  CompanyResearchAgentBlock,
  CompanyResearchLanguage,
  CompanyResearchMessage,
  JsonValue,
} from '../../../entities/company-research';

export type CompanyResearchThinkingStep = Readonly<{
  stepId: string;
  agentName?: string;
  title?: string;
  titleZh?: string;
  titleEn?: string;
  summary: string;
  summaryZh?: string;
  summaryEn?: string;
  progress?: number;
  sourceRefs?: readonly string[];
  sourceLinks?: readonly CompanyResearchSourceLink[];
  eventType?: string;
  seq?: number;
  createTime?: string;
}>;

export type CompanyResearchSourceLink = Readonly<{
  url: string;
  label: string;
}>;

type ThinkingStepWithOrder = Readonly<{
  step: CompanyResearchThinkingStep;
  order: number;
}>;

function isRecord(value: JsonValue | undefined): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: JsonValue | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function integerValue(value: JsonValue | undefined): number | undefined {
  const parsed = numberValue(value);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}

function progressValue(value: JsonValue | undefined): number | undefined {
  const parsed = numberValue(value);
  return parsed !== undefined && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

function stringValues(value: JsonValue | undefined): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.flatMap((item) => {
    const parsed = textValue(item);
    if (parsed) return [parsed];
    if (!isRecord(item)) return [];
    const sourceValue = textValue(item.url) ?? textValue(item.href) ?? textValue(item.title);
    return sourceValue ? [sourceValue] : [];
  });
  return values.length > 0 ? values : undefined;
}

function httpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function sourceLinks(
  value: JsonValue | undefined,
): readonly CompanyResearchSourceLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links = value.flatMap((item) => {
    if (typeof item === 'string') {
      const url = httpUrl(textValue(item));
      return url ? [{ url, label: url }] : [];
    }
    if (!isRecord(item)) return [];
    const url = httpUrl(textValue(item.url) ?? textValue(item.href));
    return url
      ? [
          {
            url,
            label: textValue(item.title) ?? textValue(item.label) ?? url,
          },
        ]
      : [];
  });
  return links.length > 0 ? links : undefined;
}

function getMetadataEntries(metadata: JsonValue | undefined): readonly JsonValue[] {
  if (Array.isArray(metadata)) return metadata;
  if (typeof metadata === 'string' && metadata.trim()) return [metadata.trim()];
  if (!isRecord(metadata)) return [];
  if (Array.isArray(metadata.steps)) return metadata.steps;
  return [metadata];
}

function getMetadataAgentName(entry: { readonly [key: string]: JsonValue }): string | undefined {
  return (
    textValue(entry.subagentName) ??
    textValue(entry.subagent_name) ??
    textValue(entry.eventAgentName) ??
    textValue(entry.event_agent_name) ??
    textValue(entry.agentName) ??
    textValue(entry.agent_name) ??
    textValue(entry.skillName) ??
    textValue(entry.skill_name)
  );
}

function parseMetadataEntry(
  entry: JsonValue,
  message: CompanyResearchMessage,
  messageIndex: number,
  entryIndex: number,
): CompanyResearchThinkingStep | undefined {
  if (typeof entry === 'string') {
    const summary = entry.trim();
    return summary
      ? {
          stepId: `${message.id ?? message.seq ?? messageIndex}-${entryIndex}-${summary}`,
          summary,
          seq: message.seq,
          createTime: message.createTime,
        }
      : undefined;
  }
  if (!isRecord(entry)) return undefined;

  const visibility = textValue(entry.visibility)?.toLowerCase();
  if (visibility && !['public', 'user_safe'].includes(visibility)) return undefined;

  const title = textValue(entry.title);
  const titleZh = textValue(entry.titleZh) ?? textValue(entry.title_zh);
  const titleEn = textValue(entry.titleEn) ?? textValue(entry.title_en);
  const summary = textValue(entry.summary) ?? textValue(entry.message) ?? textValue(entry.content);
  const summaryZh = textValue(entry.summaryZh) ?? textValue(entry.summary_zh);
  const summaryEn = textValue(entry.summaryEn) ?? textValue(entry.summary_en);
  const displaySummary = summary ?? summaryZh ?? summaryEn ?? title ?? titleZh ?? titleEn;
  if (!displaySummary) return undefined;

  const eventType = textValue(entry.eventType) ?? textValue(entry.event_type);
  const seq = integerValue(entry.seq) ?? message.seq;
  const agentName = getMetadataAgentName(entry);
  return {
    stepId: `${message.id ?? message.seq ?? messageIndex}-${entryIndex}-${seq ?? 'none'}-${agentName ?? 'agent'}-${displaySummary}`,
    agentName,
    ...(title ? { title } : {}),
    ...(titleZh ? { titleZh } : {}),
    ...(titleEn ? { titleEn } : {}),
    summary: displaySummary,
    ...(summaryZh ? { summaryZh } : {}),
    ...(summaryEn ? { summaryEn } : {}),
    progress: progressValue(entry.progress ?? entry.progressPercent ?? entry.progress_percent),
    sourceRefs: stringValues(entry.sourceRefs ?? entry.source_refs),
    sourceLinks: sourceLinks(entry.sourceRefs ?? entry.source_refs),
    eventType,
    seq,
    createTime: textValue(entry.createTime) ?? textValue(entry.create_time) ?? message.createTime,
  };
}

function compareSteps(left: ThinkingStepWithOrder, right: ThinkingStepWithOrder): number {
  const leftSeq = left.step.seq ?? Number.MAX_SAFE_INTEGER;
  const rightSeq = right.step.seq ?? Number.MAX_SAFE_INTEGER;
  if (leftSeq !== rightSeq) return leftSeq - rightSeq;
  const leftTime = left.step.createTime ?? '';
  const rightTime = right.step.createTime ?? '';
  const timeComparison = leftTime.localeCompare(rightTime);
  return timeComparison !== 0 ? timeComparison : left.order - right.order;
}

export function normalizeResearchAgentName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_agent$/, '');
}

export function getCompanyResearchThinkingStepSummary(
  step: CompanyResearchThinkingStep,
  language: CompanyResearchLanguage,
): string {
  return (
    (language === 'en-US' ? step.summaryEn : step.summaryZh) ??
    step.summary ??
    (language === 'en-US' ? step.summaryZh : step.summaryEn) ??
    ''
  );
}

export function getCompanyResearchThinkingStepTitle(
  step: CompanyResearchThinkingStep,
  language: CompanyResearchLanguage,
): string | undefined {
  return (
    (language === 'en-US' ? step.titleEn : step.titleZh) ??
    step.title ??
    (language === 'en-US' ? step.titleZh : step.titleEn)
  );
}

export function findCompanyResearchAgent(
  agents: readonly CompanyResearchAgentBlock[] | undefined,
  capabilityName: string,
): CompanyResearchAgentBlock | undefined {
  const normalizedCapabilityName = normalizeResearchAgentName(capabilityName);
  return agents?.find(
    (agent) => normalizeResearchAgentName(agent.agentName) === normalizedCapabilityName,
  );
}

export function getCompanyResearchThinkingSteps(
  messages: readonly CompanyResearchMessage[] | undefined,
  agent?: CompanyResearchAgentBlock,
): readonly CompanyResearchThinkingStep[] {
  const steps: ThinkingStepWithOrder[] = [];
  let order = 0;

  (messages ?? []).forEach((message, messageIndex) => {
    if (message.stage?.trim().toUpperCase() !== 'THINKING') return;
    const metadataSteps = getMetadataEntries(message.metadata)
      .map((entry, entryIndex) => parseMetadataEntry(entry, message, messageIndex, entryIndex))
      .filter((step): step is CompanyResearchThinkingStep => Boolean(step));

    if (metadataSteps.length > 0) {
      metadataSteps.forEach((step) => steps.push({ step, order: order++ }));
      return;
    }

    const content = message.content?.trim();
    if (content) {
      steps.push({
        step: {
          stepId: `${message.id ?? message.seq ?? messageIndex}-content`,
          summary: content,
          seq: message.seq,
          createTime: message.createTime,
        },
        order: order++,
      });
    }
  });

  // Some task snapshots expose the latest user-safe event on AgentBlock.summary
  // before the full THINKING message history is available. Keep that snapshot
  // visible in the expanded trail instead of only showing it in the row summary.
  const agentSummary = agent?.summary?.trim();
  const hasAgentSummary = agentSummary
    ? steps.some(
        ({ step }) =>
          step.summary === agentSummary ||
          step.summaryZh === agentSummary ||
          step.summaryEn === agentSummary,
      )
    : true;
  if (agent && agentSummary && !hasAgentSummary) {
    steps.push({
      step: {
        stepId: `agent-summary-${agent.agentRunId ?? agent.agentName}-${agent.progress ?? 'none'}-${agentSummary}`,
        agentName: agent.eventAgentName ?? agent.agentName,
        summary: agentSummary,
        ...(agent.progress !== undefined ? { progress: agent.progress } : {}),
      },
      order: order++,
    });
  }

  const seen = new Set<string>();
  return steps
    .filter(({ step }) => {
      const identity = [step.seq ?? '', step.agentName ?? '', step.title ?? '', step.summary].join(
        '|',
      );
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .sort(compareSteps)
    .map(({ step }) => step);
}
