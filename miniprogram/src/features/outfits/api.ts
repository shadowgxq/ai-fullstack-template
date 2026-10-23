import type { components } from '../../shared/api/schema.generated';
import { ApiError, isRecord } from '../../shared/api/errors';
import { parseEnvelope, requestJson } from '../../shared/api/request';
import { parseGarment, validUuid, type Garment } from '../wardrobe/api';

export type RecommendationCreate = components['schemas']['RecommendationCreate'];
export type Selection = Omit<components['schemas']['RecommendationSelection'], 'garments'> & {
  garments: Garment[];
};
export type Recommendation = Omit<components['schemas']['RecommendationView'], 'result'> & {
  result: Selection | null;
};
export type Candidates = Omit<components['schemas']['RecommendationCandidates'], 'items'> & {
  items: Garment[];
};
export type Scene = RecommendationCreate['scene'];
export const scenes: readonly { id: Scene; label: string }[] = [
  { id: 'work', label: '通勤' },
  { id: 'daily', label: '休闲' },
  { id: 'date', label: '约会' },
  { id: 'any', label: '不限场景' },
];
function malformed(): never {
  throw new ApiError('穿搭建议数据格式不正确，请重试', 'invalid-response');
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim()))
    return malformed();
  return value;
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 64 || !value.every(validUuid))
    return malformed();
  if (new Set(value).size !== value.length) return malformed();
  return value;
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function parseSelection(value: unknown): Selection {
  if (!isRecord(value) || !validUuid(value.request_id) || !Array.isArray(value.garments))
    return malformed();
  const selected = ids(value.selected_ids);
  const garments = value.garments.map(parseGarment);
  if (
    garments.length !== selected.length ||
    garments.some((item, i) => item.id !== selected[i] || item.status !== 'wearable')
  )
    return malformed();
  return {
    request_id: value.request_id,
    selected_ids: selected,
    garments,
    reasons: strings(value.reasons),
    limitations: strings(value.limitations),
  };
}
export function parseRecommendation(value: unknown): Recommendation {
  if (
    !isRecord(value) ||
    !validUuid(value.request_id) ||
    !scenes.some((scene) => scene.id === value.scene) ||
    !['dispatch_pending', 'generating', 'ready', 'failed', 'cancelled', 'stale'].includes(
      String(value.status),
    ) ||
    !(
      value.outcome === null ||
      ['recommendation', 'no_inventory', 'no_candidates'].includes(String(value.outcome))
    ) ||
    !(
      value.error_code === null ||
      (typeof value.error_code === 'string' && value.error_code.trim())
    ) ||
    typeof value.candidate_scope_limited !== 'boolean' ||
    !timestamp(value.created_at) ||
    !timestamp(value.deadline_at)
  )
    return malformed();
  const inventory = value.inventory_count;
  const eligible = value.eligible_count;
  if (
    typeof inventory !== 'number' ||
    !Number.isSafeInteger(inventory) ||
    inventory < 0 ||
    typeof eligible !== 'number' ||
    !Number.isSafeInteger(eligible) ||
    eligible < 0 ||
    eligible > inventory
  )
    return malformed();
  const result = value.result === null ? null : parseSelection(value.result);
  if (result && result.request_id !== value.request_id) return malformed();
  if (
    value.status === 'ready'
      ? !value.outcome || (value.outcome === 'recommendation') !== Boolean(result)
      : result !== null
  )
    return malformed();
  return {
    request_id: value.request_id,
    status: value.status as Recommendation['status'],
    scene: value.scene as Scene,
    outcome: value.outcome as Recommendation['outcome'],
    error_code: value.error_code as string | null,
    inventory_count: inventory,
    eligible_count: eligible,
    candidate_scope_limited: value.candidate_scope_limited,
    limitations: strings(value.limitations),
    result,
    created_at: value.created_at,
    deadline_at: value.deadline_at,
  };
}
export function parseCandidates(value: unknown): Candidates {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    !(
      value.next_cursor === null ||
      (typeof value.next_cursor === 'string' &&
        value.next_cursor.length > 0 &&
        value.next_cursor.length <= 4096)
    )
  )
    return malformed();
  const items = value.items.map(parseGarment);
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.some((item) => item.status !== 'wearable')
  )
    return malformed();
  return { items, next_cursor: value.next_cursor };
}
function path(id: string): string {
  if (!validUuid(id)) throw new ApiError('穿搭建议标识无效', 'configuration');
  return '/api/v1/recommendations/' + id;
}
function matchView(body: unknown, id: string): Recommendation {
  const view = parseEnvelope(body, parseRecommendation);
  if (view.request_id !== id) return malformed();
  return view;
}
export const recommendationApi = {
  create: (payload: RecommendationCreate, key: string, signal?: AbortSignal) =>
    requestJson('/api/v1/recommendations', (body) => parseEnvelope(body, parseRecommendation), {
      method: 'POST',
      data: payload,
      idempotencyKey: key,
      signal,
    }),
  read: (id: string, signal?: AbortSignal) =>
    requestJson(path(id), (body) => matchView(body, id), { signal }),
  cancel: (id: string, signal?: AbortSignal) =>
    requestJson(path(id) + '/cancel', (body) => matchView(body, id), { method: 'POST', signal }),
  validate: (id: string, selectedIds: string[], signal?: AbortSignal) => {
    const selected = ids(selectedIds);
    return requestJson(
      path(id) + '/validate-selection',
      (body) => {
        const result = parseEnvelope(body, parseSelection);
        if (
          result.request_id !== id ||
          JSON.stringify(result.selected_ids) !== JSON.stringify(selected)
        )
          return malformed();
        return result;
      },
      { method: 'POST', data: { selected_ids: selected }, signal },
    );
  },
  candidates: (id: string, exclude: string[], cursor: string | null, signal?: AbortSignal) => {
    if (
      exclude.length > 64 ||
      !exclude.every(validUuid) ||
      new Set(exclude).size !== exclude.length
    )
      return malformed();
    const query = [
      ...exclude.map((value) => 'exclude_ids=' + encodeURIComponent(value)),
      'page_size=20',
    ];
    if (cursor) query.push('cursor=' + encodeURIComponent(cursor));
    return requestJson(
      path(id) + '/replacement-candidates?' + query.join('&'),
      (body) => {
        const result = parseEnvelope(body, parseCandidates);
        if (
          result.items.some((item) => exclude.includes(item.id)) ||
          (cursor && result.next_cursor === cursor)
        )
          return malformed();
        return result;
      },
      { signal },
    );
  },
};
