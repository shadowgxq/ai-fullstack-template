import type { Garment } from '../src/features/wardrobe/api';
import type { Recommendation, Selection } from '../src/features/outfits/api';
export const requestId = '33333333-3333-4333-8333-333333333333';
export const garmentA: Garment = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '衬衫',
  category: null,
  color: null,
  photo_media_id: null,
  season: [],
  occasion: [],
  tags: [],
  notes: null,
  status: 'wearable',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
export const garmentB: Garment = {
  ...garmentA,
  id: '22222222-2222-4222-8222-222222222222',
  name: '外套',
};
export const garmentC: Garment = {
  ...garmentA,
  id: '44444444-4444-4444-8444-444444444444',
  name: '长裤',
};
export function selection(
  items: Garment[] = [garmentA],
  reasons: string[] = ['已核验当前选择'],
): Selection {
  return {
    request_id: requestId,
    selected_ids: items.map((item) => item.id),
    garments: items,
    reasons,
    limitations: ['部分属性未知'],
  };
}
export function view(patch: Partial<Recommendation> = {}): Recommendation {
  return {
    request_id: requestId,
    status: 'ready',
    scene: 'any',
    outcome: 'recommendation',
    result: selection(),
    error_code: null,
    inventory_count: 3,
    eligible_count: 3,
    candidate_scope_limited: false,
    limitations: [],
    created_at: '2026-01-01T00:00:00Z',
    deadline_at: '2026-01-01T00:05:00Z',
    ...patch,
  };
}
