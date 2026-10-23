import { describe, expect, it } from 'vitest';
import {
  isWeatherDayCurrent,
  nextShanghaiMidnight,
  weatherTime,
  weatherTimestamp,
} from '../src/features/weather/time';
describe('weather business day and source time', () => {
  it('expires exactly at Shanghai midnight irrespective of the device timezone', () => {
    const end = '2026-10-23T00:00:00+08:00';
    expect(nextShanghaiMidnight('2026-10-22')).toBe(Date.parse(end));
    expect(isWeatherDayCurrent('2026-10-22', end, Date.parse(end) - 1)).toBe(true);
    expect(isWeatherDayCurrent('2026-10-22', end, Date.parse(end))).toBe(false);
    expect(
      isWeatherDayCurrent('2026-10-22', '2026-10-23T01:00:00+08:00', Date.parse(end) - 1),
    ).toBe(false);
    expect(isWeatherDayCurrent('2026-10-23', end, Date.parse(end) - 1)).toBe(false);
  });
  it('keeps explicit source timestamps and rejects unzoned timestamps or invalid dates', () => {
    expect(weatherTime('2026-10-22T01:15:00Z')).toBe('2026-10-22 09:15（北京时间）');
    expect(weatherTimestamp('2026-10-22T09:15:00')).toBe(false);
    expect(weatherTimestamp('not-a-time')).toBe(false);
    expect(Number.isNaN(nextShanghaiMidnight('2026-02-30'))).toBe(true);
  });
});
