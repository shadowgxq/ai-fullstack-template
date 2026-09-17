import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COMPANY_RESEARCH_EVENT_REFRESH_DEBOUNCE_MS,
  COMPANY_RESEARCH_EVENT_REFRESH_MAX_WAIT_MS,
  createTaskEventRefreshScheduler,
} from './company-research-event-refresh';

describe('company research event refresh scheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst of events until 500ms of silence', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = createTaskEventRefreshScheduler(refresh);

    scheduler.schedule();
    vi.advanceTimersByTime(COMPANY_RESEARCH_EVENT_REFRESH_DEBOUNCE_MS - 1);
    scheduler.schedule();
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(COMPANY_RESEARCH_EVENT_REFRESH_DEBOUNCE_MS - 2);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.close();
  });

  it('refreshes at max wait when events never stop', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = createTaskEventRefreshScheduler(refresh);

    scheduler.schedule();
    for (let elapsed = 400; elapsed < COMPANY_RESEARCH_EVENT_REFRESH_MAX_WAIT_MS; elapsed += 400) {
      vi.advanceTimersByTime(400);
      scheduler.schedule();
    }

    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.close();
  });

  it('flushes terminal refreshes immediately and cancels pending work on close', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = createTaskEventRefreshScheduler(refresh);

    scheduler.schedule();
    scheduler.flush();
    expect(refresh).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    scheduler.close();
    vi.advanceTimersByTime(COMPANY_RESEARCH_EVENT_REFRESH_MAX_WAIT_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
