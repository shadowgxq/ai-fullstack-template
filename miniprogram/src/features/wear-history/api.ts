import type { components, operations } from '../../shared/api/schema.generated';
import { ApiError, isRecord } from '../../shared/api/errors';
import { parseEnvelope, requestJson } from '../../shared/api/request';
import { validUuid } from '../wardrobe/api';
import { isCalendarDate } from './date';
import type { WearDraft } from './draft';

export type WearCreate = components['schemas']['WearCreate'];
export type WearCreated = components['schemas']['WearCreated'];
export type WearPatch = components['schemas']['WearPatch'];
export type WearItem = components['schemas']['WearItem'];
export type WearRecord = components['schemas']['WearView'];
export type WearList = components['schemas']['WearList'];
export type WearDeleted = components['schemas']['WearDeleted'];
type ListQuery = NonNullable<
  operations['list_wear_records_api_v1_wear_records_get']['parameters']['query']
>;
export type WearFilters = Pick<ListQuery, 'start_date' | 'end_date'>;
function malformed(): never {
  throw new ApiError('穿着记录数据格式不正确，请重试', 'invalid-response');
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function nullable(value: unknown): string | null {
  return value === null || typeof value === 'string' ? value : malformed();
}
export function parseWearItem(value: unknown): WearItem {
  if (!isRecord(value) || !validUuid(value.garment_id)) return malformed();
  return {
    garment_id: value.garment_id,
    name_snapshot: nullable(value.name_snapshot),
    category_snapshot: nullable(value.category_snapshot),
  };
}
export function parseWearRecord(value: unknown): WearRecord {
  if (
    !isRecord(value) ||
    !validUuid(value.id) ||
    !positive(value.version) ||
    !isCalendarDate(value.wear_date) ||
    !timestamp(value.created_at) ||
    !timestamp(value.updated_at) ||
    !Array.isArray(value.items) ||
    !value.items.length ||
    value.items.length > 1000
  )
    return malformed();
  const items = value.items.map(parseWearItem);
  if (new Set(items.map((item) => item.garment_id)).size !== items.length) return malformed();
  if (value.recommendation_request_id != null && !validUuid(value.recommendation_request_id))
    return malformed();
  return {
    id: value.id,
    version: value.version,
    wear_date: value.wear_date,
    created_at: value.created_at,
    updated_at: value.updated_at,
    items,
    ...(value.recommendation_request_id !== undefined
      ? { recommendation_request_id: value.recommendation_request_id as string | null }
      : {}),
  };
}
export function parseWearList(value: unknown): WearList {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !(value.next_cursor === null || (typeof value.next_cursor === 'string' && value.next_cursor))
  )
    return malformed();
  return { items: value.items.map(parseWearRecord), next_cursor: value.next_cursor };
}
export function parseWearCreated(value: unknown): WearCreated {
  if (!isRecord(value) || !validUuid(value.id) || !positive(value.version)) return malformed();
  return { id: value.id, version: value.version };
}
export function parseWearDeleted(value: unknown): WearDeleted {
  if (!isRecord(value) || !validUuid(value.id) || value.deleted !== true) return malformed();
  return { id: value.id, deleted: true };
}
export function wearInput(draft: WearDraft): WearCreate {
  if (draft.recommendationRequestId !== undefined && !validUuid(draft.recommendationRequestId))
    return malformed();
  return {
    wear_date: draft.wearDate,
    garment_ids: [...new Set(draft.garmentIds)].sort(),
    ...(draft.recommendationRequestId
      ? { recommendation_request_id: draft.recommendationRequestId }
      : {}),
  };
}
export function draftFromWear(record: WearRecord): WearDraft {
  return { wearDate: record.wear_date, garmentIds: record.items.map((item) => item.garment_id) };
}
export function wearQuery(filters: WearFilters, cursor?: string | null): string {
  const query = Object.entries({ ...filters, cursor, page_size: 20 })
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
    .join('&');
  return '/api/v1/wear-records?' + query;
}
function recordPath(id: string): string {
  if (!validUuid(id)) throw new ApiError('穿着记录标识无效', 'configuration');
  return '/api/v1/wear-records/' + id;
}
export const wearApi = {
  list: (filters: WearFilters, cursor?: string | null, signal?: AbortSignal) =>
    requestJson(wearQuery(filters, cursor), (body) => parseEnvelope(body, parseWearList), {
      signal,
    }),
  record: (id: string, signal?: AbortSignal) =>
    requestJson(recordPath(id), (body) => parseEnvelope(body, parseWearRecord), { signal }),
  create: (payload: WearCreate, key: string, signal?: AbortSignal) =>
    requestJson('/api/v1/wear-records', (body) => parseEnvelope(body, parseWearCreated), {
      method: 'POST',
      data: payload,
      idempotencyKey: key,
      signal,
    }),
  patch: (id: string, payload: WearPatch, signal?: AbortSignal) =>
    requestJson(recordPath(id), (body) => parseEnvelope(body, parseWearRecord), {
      method: 'PATCH',
      data: payload,
      signal,
    }),
  remove: (id: string, version: number, signal?: AbortSignal) =>
    requestJson(
      recordPath(id) + '?expected_version=' + encodeURIComponent(version),
      (body) => parseEnvelope(body, parseWearDeleted),
      { method: 'DELETE', signal },
    ),
};
