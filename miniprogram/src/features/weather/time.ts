import { isCalendarDate, shanghaiToday } from '../wear-history/date';

export function weatherTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    isCalendarDate(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function nextShanghaiMidnight(day: string): number {
  if (!isCalendarDate(day)) return NaN;
  return Date.parse(day + 'T00:00:00+08:00') + 24 * 60 * 60 * 1000;
}
export function isWeatherDayCurrent(day: string, validUntil: string, now = Date.now()): boolean {
  return (
    day === shanghaiToday(now) &&
    weatherTimestamp(validUntil) &&
    Date.parse(validUntil) === nextShanghaiMidnight(day) &&
    now < Date.parse(validUntil)
  );
}
export function weatherTime(value: string): string {
  if (!weatherTimestamp(value)) return '时间未知';
  return (
    new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ') +
    '（北京时间）'
  );
}
