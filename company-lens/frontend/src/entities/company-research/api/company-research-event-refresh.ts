export const COMPANY_RESEARCH_EVENT_REFRESH_DEBOUNCE_MS = 500;
export const COMPANY_RESEARCH_EVENT_REFRESH_MAX_WAIT_MS = 3000;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

type TaskEventRefreshSchedulerOptions = Readonly<{
  debounceMs?: number;
  maxWaitMs?: number;
}>;

/** 合并事件触发的任务快照刷新，同时保证持续事件不会让刷新无限延后。 */
export function createTaskEventRefreshScheduler(
  refresh: () => Promise<unknown> | unknown,
  options: TaskEventRefreshSchedulerOptions = {},
) {
  const debounceMs = options.debounceMs ?? COMPANY_RESEARCH_EVENT_REFRESH_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? COMPANY_RESEARCH_EVENT_REFRESH_MAX_WAIT_MS;
  let debounceTimer: TimerHandle | undefined;
  let maxWaitTimer: TimerHandle | undefined;
  let hasPendingRefresh = false;
  let refreshInFlight = false;
  let refreshAfterInFlight = false;
  let isClosed = false;

  const clearDebounceTimer = () => {
    if (debounceTimer === undefined) return;
    globalThis.clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  const clearMaxWaitTimer = () => {
    if (maxWaitTimer === undefined) return;
    globalThis.clearTimeout(maxWaitTimer);
    maxWaitTimer = undefined;
  };

  const settleRefresh = () => {
    refreshInFlight = false;
    if (isClosed || !refreshAfterInFlight) return;
    refreshAfterInFlight = false;
    schedule();
  };

  const run = () => {
    clearDebounceTimer();
    clearMaxWaitTimer();
    if (isClosed || !hasPendingRefresh) return;

    hasPendingRefresh = false;
    if (refreshInFlight) {
      refreshAfterInFlight = true;
      return;
    }

    refreshInFlight = true;
    void Promise.resolve()
      .then(refresh)
      .then(settleRefresh, settleRefresh);
  };

  function schedule() {
    if (isClosed) return;
    hasPendingRefresh = true;
    clearDebounceTimer();
    debounceTimer = globalThis.setTimeout(run, debounceMs);
    if (maxWaitTimer === undefined) {
      maxWaitTimer = globalThis.setTimeout(run, maxWaitMs);
    }
  }

  function flush() {
    if (isClosed) return;
    hasPendingRefresh = true;
    run();
  }

  function close() {
    isClosed = true;
    hasPendingRefresh = false;
    refreshAfterInFlight = false;
    clearDebounceTimer();
    clearMaxWaitTimer();
  }

  return { schedule, flush, close } as const;
}
