import type { components } from '../../shared/api/schema.generated';
import { ApiError, isRecord } from '../../shared/api/errors';
import { parseEnvelope, requestJson } from '../../shared/api/request';
import { validUuid } from '../wardrobe/api';
import { isCalendarDate } from '../wear-history/date';
import { segmentTrend } from './trend';

export type Statistics = components['schemas']['StatisticsView'];
export type CategoryCount = components['schemas']['CategoryCount'];
export type DailyWearCount = components['schemas']['DailyWearCount'];
export type WearTrend = components['schemas']['WearTrend'];
export type GarmentWearCount = components['schemas']['GarmentWearCount'];
export type GarmentCountsPage = components['schemas']['GarmentCountsPage'];
function malformed(): never {
  throw new ApiError('统计数据格式不正确，请重试', 'invalid-response');
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return malformed();
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null || typeof value === 'string' ? value : malformed();
}
function parseCategory(value: unknown): CategoryCount {
  if (!isRecord(value)) return malformed();
  return { category: nullableText(value.category), count: count(value.count) };
}
function parseDay(value: unknown): DailyWearCount {
  if (!isRecord(value) || !isCalendarDate(value.date)) return malformed();
  return { date: value.date, count: count(value.count) };
}
export function parseWearTrend(value: unknown): WearTrend {
  if (
    !isRecord(value) ||
    !isCalendarDate(value.start_date) ||
    !isCalendarDate(value.end_date) ||
    value.timezone !== 'Asia/Shanghai' ||
    !Array.isArray(value.days)
  )
    return malformed();
  const days = value.days.map(parseDay);
  try {
    segmentTrend(days.map((day) => [day.date, day.count] as const));
  } catch {
    return malformed();
  }
  if (days[0].date !== value.start_date || days[29].date !== value.end_date) return malformed();
  return { start_date: value.start_date, end_date: value.end_date, timezone: value.timezone, days };
}
function parseGarmentCount(value: unknown): GarmentWearCount {
  if (
    !isRecord(value) ||
    !validUuid(value.garment_id) ||
    typeof value.status !== 'string' ||
    !['wearable', 'unavailable', 'archived'].includes(value.status)
  )
    return malformed();
  return {
    garment_id: value.garment_id,
    name: nullableText(value.name),
    category: nullableText(value.category),
    status: value.status as GarmentWearCount['status'],
    wear_count: count(value.wear_count),
  };
}
function parseGarments(value: unknown): GarmentCountsPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !(value.next_cursor === null || (typeof value.next_cursor === 'string' && value.next_cursor))
  )
    return malformed();
  const items = value.items.map(parseGarmentCount);
  if (
    new Set(items.map((item) => item.garment_id.toLowerCase())).size !== items.length ||
    (value.next_cursor !== null && !items.length)
  )
    return malformed();
  for (let index = 1; index < items.length; index += 1) {
    const before = items[index - 1],
      after = items[index];
    if (
      before.wear_count < after.wear_count ||
      (before.wear_count === after.wear_count &&
        before.garment_id.toLowerCase() < after.garment_id.toLowerCase())
    )
      return malformed();
  }
  return { items, next_cursor: value.next_cursor };
}
export function parseStatistics(value: unknown): Statistics {
  if (!isRecord(value) || !Array.isArray(value.category_counts)) return malformed();
  const wardrobe_total = count(value.wardrobe_total),
    archived_count = count(value.archived_count),
    wear_record_count = count(value.wear_record_count);
  // 接受已保存的旧版 HTTP 证据和当前运行中的旧提供方；缺少新增计数时不补零。
  const wearable_count = value.wearable_count == null ? null : count(value.wearable_count);
  const unavailable_count = value.unavailable_count == null ? null : count(value.unavailable_count);
  const category_counts = value.category_counts.map(parseCategory);
  const trend = parseWearTrend(value.trend);
  const garment_counts = parseGarments(value.garment_counts);
  if (
    new Set(category_counts.map((item) => item.category)).size !== category_counts.length ||
    category_counts.reduce((sum, item) => sum + item.count, 0) !== wardrobe_total ||
    trend.days.reduce((sum, day) => sum + day.count, 0) > wear_record_count ||
    garment_counts.items.length > wardrobe_total + archived_count ||
    (wearable_count !== null && wearable_count > wardrobe_total) ||
    (unavailable_count !== null && unavailable_count > wardrobe_total) ||
    (wearable_count !== null &&
      unavailable_count !== null &&
      wearable_count + unavailable_count !== wardrobe_total)
  )
    return malformed();
  return {
    wardrobe_total,
    wearable_count,
    unavailable_count,
    archived_count,
    wear_record_count,
    category_counts,
    trend,
    garment_counts,
  };
}
export const statisticsApi = {
  read: (cursor?: string | null, signal?: AbortSignal) =>
    requestJson(
      '/api/v1/statistics?page_size=20' +
        (cursor ? '&garment_cursor=' + encodeURIComponent(cursor) : ''),
      (body) => parseEnvelope(body, parseStatistics),
      { signal },
    ),
};
