import { afterEach, describe, expect, it } from 'vitest';

import {
  clearResearchProgressRecord,
  getOrCreateResearchProgressRecord,
  getResearchProgressStorageKey,
  persistResearchProgressRecord,
  readResearchProgressRecord,
  resetResearchProgressRecord,
  RESEARCH_PROGRESS_STORAGE_TTL_MS,
} from './research-progress-storage';

afterEach(() => {
  localStorage.clear();
});

describe('research progress storage', () => {
  it('creates a zero-based record and restores it before the one-hour expiry', () => {
    const now = 1_000_000;
    const created = getOrCreateResearchProgressRecord('task/1', now);

    expect(created).toEqual({
      startedAt: now,
      expiresAt: now + RESEARCH_PROGRESS_STORAGE_TTL_MS,
      lastProgress: 0,
      status: 'unknown',
    });
    expect(getOrCreateResearchProgressRecord('task/1', now + 10_000)).toEqual(created);
    expect(localStorage.getItem(getResearchProgressStorageKey('task/1'))).toContain('startedAt');
  });

  it('removes an expired record and starts a new zero-based record', () => {
    const now = 1_000_000;
    const created = getOrCreateResearchProgressRecord('task-1', now);

    expect(getOrCreateResearchProgressRecord('task-1', created!.expiresAt + 1)).toEqual({
      startedAt: created!.expiresAt + 1,
      expiresAt: created!.expiresAt + 1 + RESEARCH_PROGRESS_STORAGE_TTL_MS,
      lastProgress: 0,
      status: 'unknown',
    });
  });

  it('persists the latest visible progress and clears it after report completion', () => {
    const record = getOrCreateResearchProgressRecord('task-1', 1_000_000)!;
    persistResearchProgressRecord(
      'task-1',
      { ...record, lastProgress: 68, status: 'analyzing' },
      1_001_000,
    );

    expect(readResearchProgressRecord('task-1', 1_001_000)).toMatchObject({
      lastProgress: 68,
      status: 'analyzing',
    });

    persistResearchProgressRecord(
      'task-1',
      { ...record, lastProgress: 68, status: 'failed' },
      1_001_100,
    );
    expect(readResearchProgressRecord('task-1', 1_001_100)).toMatchObject({
      lastProgress: 68,
      status: 'failed',
    });

    clearResearchProgressRecord('task-1');

    expect(readResearchProgressRecord('task-1', 1_001_000)).toBeUndefined();
  });

  it('resets a report retry to the 80 percent collecting baseline', () => {
    const record = resetResearchProgressRecord('task-1', 'collecting', 80, 2_000_000);

    expect(record).toEqual({
      startedAt: 2_000_000,
      expiresAt: 2_000_000 + RESEARCH_PROGRESS_STORAGE_TTL_MS,
      lastProgress: 80,
      status: 'collecting',
      phase: 'report-retry',
    });
    expect(readResearchProgressRecord('task-1', 2_000_001)).toMatchObject({
      lastProgress: 80,
      status: 'collecting',
      phase: 'report-retry',
    });
  });
});
