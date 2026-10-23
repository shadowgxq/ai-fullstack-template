import { isCalendarDate } from '../wear-history/date';

export interface TrendSegment {
  startDate: string;
  endDate: string;
  dayCount: number;
  count: number;
}
/** 分段只汇总给定的真实30日序列，最后一段为2日，不补造周数或日期。 */
export function segmentTrend(days: readonly (readonly [string, number])[]): TrendSegment[] {
  if (days.length !== 30) throw new Error('趋势必须包含连续30日');
  const dayMs = 24 * 60 * 60 * 1000;
  for (let index = 0; index < days.length; index += 1) {
    const [date, count] = days[index];
    if (!isCalendarDate(date) || !Number.isSafeInteger(count) || count < 0)
      throw new Error('趋势日期或数量无效');
    if (
      index &&
      Date.parse(date + 'T00:00:00Z') - Date.parse(days[index - 1][0] + 'T00:00:00Z') !== dayMs
    )
      throw new Error('趋势日期必须连续');
  }
  const segments: TrendSegment[] = [];
  for (let index = 0; index < days.length; index += 7) {
    const part = days.slice(index, index + 7);
    const count = part.reduce((sum, day) => sum + day[1], 0);
    if (!Number.isSafeInteger(count)) throw new Error('趋势数量超出可显示范围');
    segments.push({
      startDate: part[0][0],
      endDate: part[part.length - 1][0],
      dayCount: part.length,
      count,
    });
  }
  return segments;
}
/** 条长相对最大类别数量，不表示库存占比。 */
export function categoryWidths(counts: readonly number[]): number[] {
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0))
    throw new Error('类别数量无效');
  const max = counts.reduce((value, count) => Math.max(value, count), 0);
  return counts.map((count) => (max ? (count / max) * 100 : 0));
}
