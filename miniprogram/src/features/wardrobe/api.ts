import type { components, operations } from '../../shared/api/schema.generated';
import { ApiError, isRecord } from '../../shared/api/errors';
import { parseEnvelope, requestJson } from '../../shared/api/request';
import { uploadPrivatePhoto } from '../../shared/api/media';
import type { GarmentDraft } from './draft';

export type Garment = Required<components['schemas']['GarmentView']>;
export type GarmentDetail = Required<components['schemas']['GarmentDetail']>;
export type GarmentInput = components['schemas']['GarmentCreate'];
export type GarmentPatch = components['schemas']['GarmentPatch'];
export type GarmentCreated = components['schemas']['GarmentCreated'];
export type WardrobeOptions = components['schemas']['WardrobeOptions'];
export type GarmentList = components['schemas']['GarmentList'];
export type MediaReady = components['schemas']['MediaResponse'];
type ListQuery = NonNullable<
  operations['list_garments_api_v1_garments_get']['parameters']['query']
>;
export type GarmentFilters = Pick<
  ListQuery,
  'status' | 'category' | 'color' | 'season' | 'occasion' | 'tag'
>;

export function validUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
function malformed(): never {
  throw new ApiError('衣柜数据格式不正确，请重试', 'invalid-response');
}
function nullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return malformed();
  return value;
}
function strings(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  )
    return malformed();
  return value;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function parseGarment(value: unknown): Garment {
  if (
    !isRecord(value) ||
    !validUuid(value.id) ||
    !positiveInteger(value.version) ||
    typeof value.status !== 'string' ||
    !['wearable', 'unavailable', 'archived'].includes(value.status) ||
    typeof value.created_at !== 'string' ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    typeof value.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(value.updated_at))
  )
    return malformed();
  const photoId = value.photo_media_id == null ? null : value.photo_media_id;
  if (photoId !== null && !validUuid(photoId)) return malformed();
  return {
    id: value.id,
    version: value.version,
    status: value.status as Garment['status'],
    created_at: value.created_at,
    updated_at: value.updated_at,
    name: nullableText(value.name),
    photo_media_id: photoId,
    category: nullableText(value.category),
    color: nullableText(value.color),
    season: strings(value.season),
    occasion: strings(value.occasion),
    tags: strings(value.tags),
    notes: nullableText(value.notes),
  };
}
export function parseGarmentList(value: unknown): GarmentList {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !(value.next_cursor === null || typeof value.next_cursor === 'string')
  )
    return malformed();
  return { items: value.items.map(parseGarment), next_cursor: value.next_cursor };
}
export function parseGarmentDetail(value: unknown): GarmentDetail {
  const garment = parseGarment(value);
  if (
    !isRecord(value) ||
    typeof value.wear_count !== 'number' ||
    !Number.isSafeInteger(value.wear_count) ||
    value.wear_count < 0
  )
    return malformed();
  return { ...garment, wear_count: value.wear_count };
}
export function parseGarmentCreated(value: unknown): GarmentCreated {
  if (!isRecord(value) || !validUuid(value.id) || !positiveInteger(value.version))
    return malformed();
  return { id: value.id, version: value.version };
}
function choices(value: unknown): components['schemas']['CatalogOption'][] {
  if (!Array.isArray(value)) return malformed();
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.label !== 'string' ||
      !item.label.trim()
    )
      return malformed();
    return { id: item.id, label: item.label };
  });
}
export function parseOptions(value: unknown): WardrobeOptions {
  if (!isRecord(value) || typeof value.version !== 'string' || !value.version) return malformed();
  return {
    version: value.version,
    categories: choices(value.categories),
    colors: choices(value.colors),
    seasons: choices(value.seasons),
    occasions: choices(value.occasions),
    styles: choices(value.styles),
  };
}
export function garmentInput(draft: GarmentDraft): GarmentInput {
  return {
    name: draft.name.trim() || null,
    photo_media_id: draft.photoMediaId,
    category: draft.category,
    color: draft.color,
    season: [...draft.seasons],
    occasion: [...draft.occasions],
    tags: [...draft.tags],
    notes: draft.notes.trim() || null,
  };
}
export function draftFromGarment(value: Garment): GarmentDraft {
  return {
    name: value.name ?? '',
    photoMediaId: value.photo_media_id,
    category: value.category,
    color: value.color,
    seasons: [...value.season],
    occasions: [...value.occasion],
    tags: [...value.tags],
    notes: value.notes ?? '',
    expanded: false,
  };
}
export function garmentQuery(filters: GarmentFilters, cursor?: string | null): string {
  const query = Object.entries({ ...filters, cursor, page_size: 20 })
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
    .join('&');
  return '/api/v1/garments?' + query;
}
function garmentPath(id: string): string {
  if (!validUuid(id)) throw new ApiError('衣物标识无效', 'configuration');
  return '/api/v1/garments/' + id;
}
export const wardrobeApi = {
  options: (signal?: AbortSignal) =>
    requestJson('/api/v1/wardrobe/options', (body) => parseEnvelope(body, parseOptions), {
      signal,
    }),
  list: (filters: GarmentFilters, cursor?: string | null, signal?: AbortSignal) =>
    requestJson(garmentQuery(filters, cursor), (body) => parseEnvelope(body, parseGarmentList), {
      signal,
    }),
  garment: (id: string, signal?: AbortSignal) =>
    requestJson(garmentPath(id), (body) => parseEnvelope(body, parseGarmentDetail), { signal }),
  create: (payload: GarmentInput, key: string, signal?: AbortSignal) =>
    requestJson('/api/v1/garments', (body) => parseEnvelope(body, parseGarmentCreated), {
      method: 'POST',
      data: payload,
      idempotencyKey: key,
      signal,
    }),
  patch: (id: string, payload: GarmentPatch, signal?: AbortSignal) =>
    requestJson(garmentPath(id), (body) => parseEnvelope(body, parseGarment), {
      method: 'PATCH',
      data: payload,
      signal,
    }),
  upload: (filePath: string, key: string, signal?: AbortSignal) =>
    uploadPrivatePhoto(filePath, key, 'garment', signal),
};
