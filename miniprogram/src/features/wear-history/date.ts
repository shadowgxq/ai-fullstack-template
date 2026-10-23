const shanghaiOffsetMs = 8 * 60 * 60 * 1000;

/** 业务日期按 UTC+8 计算，不使用设备所在时区或创建时间的日期部分。 */
export function shanghaiToday(now: number = Date.now()): string {
  return new Date(now + shanghaiOffsetMs).toISOString().slice(0, 10);
}
export function isCalendarDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
    value.startsWith('0000')
  )
    return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateWearDate(value: string, now: number = Date.now()): string | null {
  if (!isCalendarDate(value)) return '请选择有效的穿着日期';
  return value > shanghaiToday(now) ? '不能记录未来日期的穿着' : null;
}
export function validateDateRange(start: string, end: string): string | null {
  if ((start && !isCalendarDate(start)) || (end && !isCalendarDate(end)))
    return '请选择有效的日期范围';
  return start && end && start > end ? '开始日期不能晚于结束日期' : null;
}
