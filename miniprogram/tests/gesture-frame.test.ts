import { afterEach, expect, it, vi } from 'vitest';
import { createGestureFrame } from '../src/features/component-library/gesture-frame';
afterEach(() => vi.useRealTimers());
it('coalesces a burst of touch events into one render of the newest position', () => {
  vi.useFakeTimers();
  const publish = vi.fn();
  const frames = createGestureFrame<number>(publish);
  for (let index = 0; index < 100; index++) frames.queue(index);
  expect(publish).not.toHaveBeenCalled();
  vi.advanceTimersByTime(16);
  expect(publish).toHaveBeenCalledExactlyOnceWith(99);
  frames.queue(100);
  vi.advanceTimersByTime(16);
  expect(publish).toHaveBeenLastCalledWith(100);
});
it('drops a pending render on release, cancellation, or unmount', () => {
  vi.useFakeTimers();
  const publish = vi.fn();
  const frames = createGestureFrame<number>(publish);
  frames.queue(1);
  frames.cancel();
  vi.runAllTimers();
  expect(publish).not.toHaveBeenCalled();
  frames.queue(2);
  frames.flush();
  expect(publish).toHaveBeenCalledExactlyOnceWith(2);
  vi.runAllTimers();
  expect(publish).toHaveBeenCalledTimes(1);
});
