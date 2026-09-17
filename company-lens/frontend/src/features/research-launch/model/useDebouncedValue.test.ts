import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes a changed value only after the requested delay and cancels stale timers', () => {
    vi.useFakeTimers();
    const hook = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'first' },
    });

    hook.rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(hook.result.current).toBe('first');

    hook.rerender({ value: 'third' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(hook.result.current).toBe('third');
  });
});
