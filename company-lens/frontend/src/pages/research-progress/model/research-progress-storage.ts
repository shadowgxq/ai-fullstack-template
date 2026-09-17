export const RESEARCH_PROGRESS_STORAGE_TTL_MS = 60 * 60 * 1000;
export const RESEARCH_PROGRESS_STORAGE_KEY_PREFIX = 'ai-berkshire.research-progress:';
export const RESEARCH_PROGRESS_RETRY_BASELINE = 80;
export const RESEARCH_PROGRESS_REPORT_RETRY_PHASE = 'report-retry' as const;

export const RESEARCH_PROGRESS_STORAGE_STATUSES = [
  'pending',
  'resolving',
  'collecting',
  'analyzing',
  'synthesizing',
  'completed',
  'partial',
  'failed',
  'cancelled',
  'unknown',
] as const;

export type ResearchProgressStorageStatus = (typeof RESEARCH_PROGRESS_STORAGE_STATUSES)[number];
export type ResearchProgressStoragePhase = typeof RESEARCH_PROGRESS_REPORT_RETRY_PHASE;

export type ResearchProgressStorageRecord = Readonly<{
  startedAt: number;
  expiresAt: number;
  lastProgress: number;
  status: ResearchProgressStorageStatus;
  phase?: ResearchProgressStoragePhase;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampStoredProgress(value: unknown): number {
  return isFiniteNumber(value) ? Math.min(99, Math.max(0, value)) : 0;
}

function isResearchProgressStorageStatus(value: string): value is ResearchProgressStorageStatus {
  return (RESEARCH_PROGRESS_STORAGE_STATUSES as readonly string[]).includes(value);
}

function normalizeStoredStatus(value: unknown): ResearchProgressStorageStatus {
  return typeof value === 'string' && isResearchProgressStorageStatus(value) ? value : 'unknown';
}

function normalizeStoredPhase(value: unknown): ResearchProgressStoragePhase | undefined {
  return value === RESEARCH_PROGRESS_REPORT_RETRY_PHASE
    ? RESEARCH_PROGRESS_REPORT_RETRY_PHASE
    : undefined;
}

function getStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function getResearchProgressStorageKey(taskId: string): string {
  return `${RESEARCH_PROGRESS_STORAGE_KEY_PREFIX}${encodeURIComponent(taskId)}`;
}

export function readResearchProgressRecord(
  taskId: string,
  now = Date.now(),
): ResearchProgressStorageRecord | undefined {
  const storage = getStorage();
  if (!storage || !taskId) return undefined;

  const key = getResearchProgressStorageKey(taskId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error('Invalid research progress record.');

    const startedAt = parsed.startedAt;
    const expiresAt = parsed.expiresAt;
    if (
      !isFiniteNumber(startedAt) ||
      !isFiniteNumber(expiresAt) ||
      expiresAt <= now ||
      expiresAt <= startedAt ||
      expiresAt - startedAt > RESEARCH_PROGRESS_STORAGE_TTL_MS
    ) {
      storage.removeItem(key);
      return undefined;
    }

    const phase = normalizeStoredPhase(parsed.phase);
    return {
      startedAt,
      expiresAt,
      lastProgress: clampStoredProgress(parsed.lastProgress),
      // Records written before status persistence remain readable and are treated as unknown.
      status: normalizeStoredStatus(parsed.status),
      ...(phase ? { phase } : {}),
    };
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may become unavailable between reading and cleanup.
    }
    return undefined;
  }
}

export function getOrCreateResearchProgressRecord(
  taskId: string,
  now = Date.now(),
): ResearchProgressStorageRecord | undefined {
  if (!taskId) return undefined;

  const existing = readResearchProgressRecord(taskId, now);
  if (existing) return existing;

  const record: ResearchProgressStorageRecord = {
    startedAt: now,
    expiresAt: now + RESEARCH_PROGRESS_STORAGE_TTL_MS,
    lastProgress: 0,
    status: 'unknown',
  };
  const storage = getStorage();
  if (!storage) return record;

  try {
    storage.setItem(getResearchProgressStorageKey(taskId), JSON.stringify(record));
  } catch {
    // The page can still calculate progress for this session when storage is blocked.
  }
  return record;
}

export function persistResearchProgressRecord(
  taskId: string,
  record: ResearchProgressStorageRecord,
  now = Date.now(),
): void {
  const storage = getStorage();
  if (!storage || !taskId) return;

  const key = getResearchProgressStorageKey(taskId);
  if (record.expiresAt <= now) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
    return;
  }

  try {
    storage.setItem(
      key,
      JSON.stringify({
        ...record,
        lastProgress: clampStoredProgress(record.lastProgress),
        status: normalizeStoredStatus(record.status),
        phase: normalizeStoredPhase(record.phase),
      }),
    );
  } catch {
    // Storage may be unavailable in private browsing or restricted environments.
  }
}

/**
 * Start a new perceived-progress cycle after the final-report retry is
 * accepted. The retry reruns synthesis only, so resume below completion while
 * preserving the task's Agent results.
 */
export function resetResearchProgressRecord(
  taskId: string,
  status: ResearchProgressStorageStatus = 'collecting',
  progress = RESEARCH_PROGRESS_RETRY_BASELINE,
  now = Date.now(),
): ResearchProgressStorageRecord | undefined {
  if (!taskId) return undefined;

  const record: ResearchProgressStorageRecord = {
    startedAt: now,
    expiresAt: now + RESEARCH_PROGRESS_STORAGE_TTL_MS,
    lastProgress: Math.min(99, Math.max(0, progress)),
    status,
    phase: RESEARCH_PROGRESS_REPORT_RETRY_PHASE,
  };
  persistResearchProgressRecord(taskId, record, now);
  return record;
}

export function clearResearchProgressRecord(taskId: string): void {
  const storage = getStorage();
  if (!storage || !taskId) return;

  try {
    storage.removeItem(getResearchProgressStorageKey(taskId));
  } catch {
    // Ignore storage cleanup failures.
  }
}
