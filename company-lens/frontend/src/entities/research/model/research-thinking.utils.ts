import type { ResearchEvent, ResearchMessage, ResearchThinkingStep } from './research.types';

const USER_SAFE_VISIBILITIES = new Set(['public', 'user_safe']);
const NOISE_SUMMARIES = new Set([
  "today's date",
  'todays date',
  'current date',
  '当前日期',
  '今天日期',
  'n/a',
  'null',
  'undefined',
]);

type AgentProgressEvent = Extract<ResearchEvent, { type: 'agent_progress' }>;

type ThinkingStepCandidate = {
  stepId: string;
  agentId: string;
  agentType: string;
  summary: unknown;
  displayName?: unknown;
  title?: unknown;
  progressPercent?: unknown;
  eventType?: unknown;
  skillName?: unknown;
  visibility?: unknown;
  sourceRefs?: unknown;
  timestamp?: unknown;
  seq?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function optionalText(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function normalizeSourceRefs(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const sourceRefs = Array.from(
    new Set(value.map(normalizeText).filter((sourceRef) => sourceRef.length > 0)),
  );
  return sourceRefs.length > 0 ? sourceRefs : undefined;
}

function normalizeProgress(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100
    ? Number(value)
    : undefined;
}

function normalizeSeq(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function normalizeCandidate(candidate: ThinkingStepCandidate): ResearchThinkingStep | undefined {
  const summary = normalizeText(candidate.summary);
  const visibility = optionalText(candidate.visibility)?.toLowerCase();
  if (
    !candidate.agentId ||
    !summary ||
    NOISE_SUMMARIES.has(summary.toLowerCase()) ||
    (visibility !== undefined && !USER_SAFE_VISIBILITIES.has(visibility))
  ) {
    return undefined;
  }

  const progressPercent = normalizeProgress(candidate.progressPercent);
  if (candidate.progressPercent !== undefined && progressPercent === undefined) {
    return undefined;
  }

  const sourceRefs = normalizeSourceRefs(candidate.sourceRefs);
  const seq = normalizeSeq(candidate.seq);
  return {
    stepId: candidate.stepId,
    agentId: candidate.agentId,
    agentType: normalizeText(candidate.agentType),
    summary,
    ...(optionalText(candidate.displayName)
      ? { displayName: optionalText(candidate.displayName) }
      : {}),
    ...(optionalText(candidate.title) ? { title: optionalText(candidate.title) } : {}),
    ...(progressPercent !== undefined ? { progressPercent } : {}),
    ...(optionalText(candidate.eventType) ? { eventType: optionalText(candidate.eventType) } : {}),
    ...(optionalText(candidate.skillName) ? { skillName: optionalText(candidate.skillName) } : {}),
    ...(visibility ? { visibility } : {}),
    ...(sourceRefs ? { sourceRefs } : {}),
    ...(optionalText(candidate.timestamp) ? { timestamp: optionalText(candidate.timestamp) } : {}),
    ...(seq !== undefined ? { seq } : {}),
  };
}

function parseMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (isRecord(metadata)) {
    return metadata;
  }
  if (typeof metadata !== 'string' || !metadata.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function thinkingStepFingerprint(step: ResearchThinkingStep): string {
  return [
    step.agentId,
    step.title?.toLowerCase() ?? '',
    step.summary.toLowerCase(),
    step.progressPercent ?? '',
  ].join('|');
}

export function mergeResearchThinkingSteps(
  ...stepCollections: readonly (readonly ResearchThinkingStep[])[]
): readonly ResearchThinkingStep[] {
  const stepByFingerprint = new Map<string, ResearchThinkingStep>();
  for (const step of stepCollections.flat()) {
    const fingerprint = thinkingStepFingerprint(step);
    const existing = stepByFingerprint.get(fingerprint);
    if (!existing || (step.seq ?? 0) > (existing.seq ?? 0)) {
      stepByFingerprint.set(fingerprint, step);
    }
  }
  return Array.from(stepByFingerprint.values()).sort((left, right) => {
    if (left.seq !== undefined && right.seq !== undefined) {
      return left.seq - right.seq;
    }
    return left.timestamp?.localeCompare(right.timestamp ?? '') ?? 0;
  });
}

export function extractResearchThinkingSteps(
  messages: readonly ResearchMessage[],
): readonly ResearchThinkingStep[] {
  const steps: ResearchThinkingStep[] = [];
  for (const message of messages) {
    if (message.stage !== 'THINKING' || !message.agentRunId) {
      continue;
    }
    const rawSteps = parseMetadata(message.metadata)?.steps;
    if (!Array.isArray(rawSteps)) {
      continue;
    }
    rawSteps.forEach((rawStep, index) => {
      const candidate =
        typeof rawStep === 'string'
          ? normalizeCandidate({
              stepId: `history:${message.messageId}:${index}`,
              agentId: message.agentRunId ?? '',
              agentType: '',
              summary: rawStep,
              timestamp: message.createdAt,
            })
          : isRecord(rawStep)
            ? normalizeCandidate({
                stepId: `history:${message.messageId}:${index}`,
                agentId: message.agentRunId ?? '',
                agentType: normalizeText(rawStep.agentName),
                summary: rawStep.summary,
                displayName: rawStep.displayName,
                title: rawStep.title,
                progressPercent: rawStep.progress,
                eventType: rawStep.eventType,
                skillName: rawStep.skillName,
                visibility: rawStep.visibility,
                sourceRefs: rawStep.sourceRefs,
                timestamp: rawStep.timestamp ?? message.createdAt,
              })
            : undefined;
      if (candidate) {
        steps.push(candidate);
      }
    });
  }
  return mergeResearchThinkingSteps(steps);
}

export function createResearchThinkingStepFromEvent(
  event: AgentProgressEvent,
): ResearchThinkingStep | undefined {
  if (!event.visibility || !USER_SAFE_VISIBILITIES.has(event.visibility.trim().toLowerCase())) {
    return undefined;
  }
  return normalizeCandidate({
    stepId: `sse:${event.seq}`,
    agentId: event.agentId,
    agentType: event.agentType,
    summary: event.summary,
    displayName: event.displayName,
    title: event.title,
    progressPercent: event.progressPercent,
    eventType: event.eventType,
    skillName: event.skillName,
    visibility: event.visibility,
    sourceRefs: event.sourceRefs,
    timestamp: event.timestamp,
    seq: event.seq,
  });
}
