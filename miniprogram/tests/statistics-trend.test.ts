import { describe, expect, it } from 'vitest';
import { categoryWidths, segmentTrend } from '../src/features/statistics/trend';
function days(start: string): (readonly [string, number])[] {
  return Array.from(
    { length: 30 },
    (_, index) =>
      [
        new Date(Date.parse(start + 'T00:00:00Z') + index * 86400000).toISOString().slice(0, 10),
        index,
      ] as const,
  );
}
describe('statistics presentation ranges', () => {
  it('segments a leap-day/month boundary into 7/7/7/7/2 actual ranges and preserves every count', () => {
    const source = days('2024-02-20');
    const result = segmentTrend(source);
    expect(result.map((part) => part.dayCount)).toEqual([7, 7, 7, 7, 2]);
    expect(result.map((part) => [part.startDate, part.endDate])).toEqual([
      ['2024-02-20', '2024-02-26'],
      ['2024-02-27', '2024-03-04'],
      ['2024-03-05', '2024-03-11'],
      ['2024-03-12', '2024-03-18'],
      ['2024-03-19', '2024-03-20'],
    ]);
    expect(result.reduce((sum, part) => sum + part.count, 0)).toBe(
      source.reduce((sum, day) => sum + day[1], 0),
    );
    expect(source).toHaveLength(30);
  });
  it('keeps zero values and rejects missing, duplicate, invalid or nonconsecutive dates', () => {
    expect(
      segmentTrend(days('2026-01-01').map(([date]) => [date, 0] as const)).every(
        (part) => part.count === 0,
      ),
    ).toBe(true);
    expect(() => segmentTrend(days('2026-01-01').slice(1))).toThrow();
    const duplicate = days('2026-01-01');
    duplicate[2] = duplicate[1];
    expect(() => segmentTrend(duplicate)).toThrow();
    const invalid = days('2026-02-01');
    invalid[28] = ['2026-02-29', 2];
    expect(() => segmentTrend(invalid)).toThrow();
  });
  it('sizes category bars by the largest count rather than the wardrobe total', () => {
    expect(categoryWidths([2, 2])).toEqual([100, 100]);
    expect(categoryWidths([10, 5, 0])).toEqual([100, 50, 0]);
    expect(categoryWidths([0, 0])).toEqual([0, 0]);
    expect(categoryWidths([])).toEqual([]);
    expect(() => categoryWidths([-1])).toThrow();
  });
});
