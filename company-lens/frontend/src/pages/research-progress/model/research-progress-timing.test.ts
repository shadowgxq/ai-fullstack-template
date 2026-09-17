import { describe, expect, it } from 'vitest';

import {
  getAgentProgressAverage,
  getDisplayedResearchProgress,
  getFixedFailedResearchProgress,
  getFakeResearchProgress,
  getReportRetryResearchProgress,
  REPORT_RETRY_PROGRESS_DURATION_MS,
  RESEARCH_PROGRESS_PHASES,
} from './research-progress-timing';

describe('getFakeResearchProgress', () => {
  it('moves from 0 to 50 during the first minute', () => {
    expect(getFakeResearchProgress(0)).toBe(0);
    expect(getFakeResearchProgress(RESEARCH_PROGRESS_PHASES.firstPhaseMs / 2)).toBe(25);
    expect(getFakeResearchProgress(RESEARCH_PROGRESS_PHASES.firstPhaseMs)).toBe(50);
  });

  it('moves from 50 to 90 during minutes one to five', () => {
    const fiveMinuteMark =
      RESEARCH_PROGRESS_PHASES.firstPhaseMs + RESEARCH_PROGRESS_PHASES.secondPhaseMs;

    expect(
      getFakeResearchProgress(fiveMinuteMark - RESEARCH_PROGRESS_PHASES.secondPhaseMs / 2),
    ).toBe(70);
    expect(getFakeResearchProgress(fiveMinuteMark)).toBe(90);
  });

  it('slowly approaches 99 and never finishes without a real report state', () => {
    const fiveMinuteMark =
      RESEARCH_PROGRESS_PHASES.firstPhaseMs + RESEARCH_PROGRESS_PHASES.secondPhaseMs;

    expect(
      getFakeResearchProgress(fiveMinuteMark + RESEARCH_PROGRESS_PHASES.finalPhaseMs / 2),
    ).toBe(95);
    expect(getFakeResearchProgress(Number.MAX_SAFE_INTEGER)).toBe(99);
  });

  it('averages Agent contributions and caps a running Agent at 96', () => {
    expect(
      getAgentProgressAverage([
        { status: 'succeeded' },
        { status: 'running', progress: 100 },
        { status: 'pending' },
      ]),
    ).toBe(196 / 3);
    expect(getAgentProgressAverage([])).toBe(0);
  });

  it('blends time and Agent completion using the reference weights', () => {
    expect(getDisplayedResearchProgress(0, [], false)).toBe(0);
    expect(getDisplayedResearchProgress(50, [], false)).toBe(50);
    expect(getDisplayedResearchProgress(50, [{ status: 'succeeded' }], false)).toBe(68);
    expect(getDisplayedResearchProgress(90, [], false)).toBe(90);
    expect(getDisplayedResearchProgress(90, [{ status: 'succeeded' }], false)).toBe(94);
    expect(getDisplayedResearchProgress(99, [], false)).toBe(99);
  });

  it('reaches 100 only after the real report state is confirmed', () => {
    expect(getDisplayedResearchProgress(99, [{ status: 'succeeded' }], false)).toBe(99);
    expect(getDisplayedResearchProgress(0, [], true)).toBe(100);
  });
});

describe('getFixedFailedResearchProgress', () => {
  it('keeps a failed task below 100% when all research Agents succeeded', () => {
    expect(
      getFixedFailedResearchProgress([
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
      ]),
    ).toBe(99);
  });

  it('uses the completed-Agent ratio for a partially completed failed task', () => {
    expect(
      getFixedFailedResearchProgress([
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'failed' },
      ]),
    ).toBe(66);
  });
});

describe('getReportRetryResearchProgress', () => {
  it('holds the 80 percent baseline and reaches 99 percent in three minutes', () => {
    expect(getReportRetryResearchProgress(0)).toBe(80);
    expect(getReportRetryResearchProgress(REPORT_RETRY_PROGRESS_DURATION_MS / 2)).toBe(90);
    expect(getReportRetryResearchProgress(REPORT_RETRY_PROGRESS_DURATION_MS)).toBe(99);
    expect(getReportRetryResearchProgress(Number.MAX_SAFE_INTEGER)).toBe(99);
  });
});
