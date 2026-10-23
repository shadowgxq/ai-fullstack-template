import { infiniteQueryOptions } from '@tanstack/react-query';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { wardrobeApi, type Garment, type GarmentFilters } from './api';

export function garmentListQueryOptions(session: AuthSession | null, filters: GarmentFilters) {
  return infiniteQueryOptions({
    queryKey: [...sessionQueryKey(session, 'garments'), JSON.stringify(filters)],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => wardrobeApi.list(filters, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(session),
  });
}

export async function changeGarmentStatus(
  session: AuthSession,
  garment: Pick<Garment, 'id' | 'version'>,
  status: Garment['status'],
): Promise<void> {
  if (getAuthSession() !== session) throw new Error('请重新读取衣物');
  const result = await wardrobeApi.patch(garment.id, { status, expected_version: garment.version });
  await invalidateGarmentFacts(session, result.id);
}

export async function invalidateGarmentFacts(session: AuthSession, id: string): Promise<void> {
  if (getAuthSession() !== session) return;
  // PATCH 是基础实体，重新读取详情才能保留真实 wear_count。
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionQueryKey(session, 'garment', id) }),
    queryClient.invalidateQueries({ queryKey: sessionQueryKey(session, 'garments') }),
    queryClient.invalidateQueries({ queryKey: sessionQueryKey(session, 'statistics') }),
  ]);
}
