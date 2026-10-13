import { beforeEach, describe, expect, it, vi } from 'vitest';

import { request } from '../../../shared/api';
import { bookmarksApi } from './bookmarks.api';

vi.mock('../../../shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api')>()),
  request: vi.fn(),
}));

const operationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const resourceId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const receipt = {
  operation_id: operationId,
  kind: 'bookmark_create',
  resource_id: resourceId,
  changed_count: 1,
};

describe('bookmark API boundary', () => {
  it.each([0, 10])(
    'sends the explicit batch target and accepts a null resource changing %s rows',
    async (changed_count) => {
      const batch = { ...receipt, kind: 'batch_move', resource_id: null, changed_count };
      const ids =
        changed_count === 10
          ? Array.from(
              { length: 10 },
              (_, index) => `bbbbbbbb-bbbb-bbbb-bbbb-${index.toString(16).padStart(12, '0')}`,
            )
          : [resourceId];
      vi.mocked(request).mockResolvedValueOnce({ code: 0, data: batch });
      expect(
        await bookmarksApi.mutate({
          operationId,
          kind: 'batch_move',
          bookmarkIds: ids,
          targetGroupId: null,
        }),
      ).toEqual(batch);
      expect(request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/bookmarks/batch-move',
        data: { bookmark_ids: ids, target_group_id: null },
        headers: { 'Idempotency-Key': operationId },
      });
      vi.mocked(request).mockResolvedValueOnce({
        code: 0,
        data: { ...batch, status: 'succeeded', error_code: null },
      });
      expect((await bookmarksApi.resolve(operationId)).changed_count).toBe(changed_count);
    },
  );
  it.each([
    { bookmarkIds: [], targetGroupId: null },
    { bookmarkIds: [resourceId, resourceId], targetGroupId: null },
    { bookmarkIds: [resourceId, resourceId.toUpperCase()], targetGroupId: null },
    {
      bookmarkIds: Array.from(
        { length: 11 },
        (_, index) => `bbbbbbbb-bbbb-bbbb-bbbb-${index.toString(16).padStart(12, '0')}`,
      ),
      targetGroupId: null,
    },
    { bookmarkIds: [resourceId], targetGroupId: undefined },
    { bookmarkIds: [resourceId], targetGroupId: 'all' },
  ])('rejects invalid batch IDs/targets before sending: $targetGroupId', async (input) => {
    await expect(
      bookmarksApi.mutate({ operationId, kind: 'batch_move', ...input }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'succeeded', resource_id: resourceId, changed_count: 1, error_code: null },
    { status: 'succeeded', resource_id: null, changed_count: 11, error_code: null },
    { status: 'failed', resource_id: null, changed_count: 1, error_code: 40914 },
  ])('rejects incompatible batch terminal facts: $status/$changed_count', async (dto) => {
    vi.mocked(request).mockResolvedValue({
      code: 0,
      data: { operation_id: operationId, kind: 'batch_move', ...dto },
    });
    await expect(bookmarksApi.resolve(operationId)).rejects.toThrow();
  });
  it('accepts an atomic batch failure without a resource or partial count', async () => {
    vi.mocked(request).mockResolvedValue({
      code: 0,
      data: {
        operation_id: operationId,
        kind: 'batch_move',
        status: 'failed',
        resource_id: null,
        changed_count: 0,
        error_code: 40914,
      },
    });
    expect(await bookmarksApi.resolve(operationId)).toMatchObject({
      status: 'failed',
      error_code: 40914,
      changed_count: 0,
    });
  });
  it.each([
    {
      kind: 'group_create' as const,
      method: 'POST',
      path: '',
      groupName: 'Reading',
      resourceId: undefined,
      changed_count: 1,
    },
    {
      kind: 'group_rename' as const,
      method: 'PATCH',
      path: `/${resourceId}`,
      groupName: 'Research',
      resourceId,
      changed_count: 1,
    },
    {
      kind: 'group_delete' as const,
      method: 'DELETE',
      path: `/${resourceId}`,
      groupName: undefined,
      resourceId,
      changed_count: 0,
    },
  ])('consumes the group $kind contract and explicit impact', async (variant) => {
    vi.mocked(request).mockResolvedValue({
      code: 0,
      data: { ...receipt, kind: variant.kind, changed_count: variant.changed_count },
    });
    await bookmarksApi.mutate({
      operationId,
      kind: variant.kind,
      groupName: variant.groupName,
      resourceId: variant.resourceId,
      expectedCount: variant.kind === 'group_delete' ? 0 : undefined,
    });
    expect(request).toHaveBeenCalledWith({
      method: variant.method,
      url: `/v1/bookmark-groups${variant.path}`,
      data: variant.kind === 'group_delete' ? undefined : { name: variant.groupName },
      ...(variant.kind === 'group_delete' ? { params: { expected_count: 0 } } : {}),
      headers: { 'Idempotency-Key': operationId },
    });
  });
  it.each([0, 8])(
    'accepts recovered group deletion transferring %s bookmarks',
    async (changed_count) => {
      vi.mocked(request).mockResolvedValue({
        code: 0,
        data: {
          ...receipt,
          kind: 'group_delete',
          changed_count,
          status: 'succeeded',
          error_code: null,
        },
      });
      expect((await bookmarksApi.resolve(operationId)).changed_count).toBe(changed_count);
    },
  );
  beforeEach(() => vi.mocked(request).mockReset());
  it('uses the shared client prefix, an explicit key and only the four fields', async () => {
    vi.mocked(request).mockResolvedValue({ code: 0, data: receipt });
    const draft = { title: 'One', url: 'https://example.com', note: '', group_id: null };
    expect(await bookmarksApi.mutate({ operationId, kind: 'bookmark_create', draft })).toEqual(
      receipt,
    );
    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/v1/bookmarks',
      data: draft,
      headers: { 'Idempotency-Key': operationId },
    });
  });
  it('rejects mismatched receipts and unsafe URLs instead of rendering them', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      code: 0,
      data: { ...receipt, operation_id: resourceId },
    });
    await expect(bookmarksApi.mutate({ operationId, kind: 'bookmark_create' })).rejects.toThrow();
    vi.mocked(request).mockResolvedValueOnce({
      code: 0,
      data: {
        id: resourceId,
        title: 'One',
        url: 'javascript:alert(1)',
        note: '',
        group_id: null,
        updated_at: '2026-10-13T00:00:00Z',
      },
    });
    await expect(bookmarksApi.get(resourceId)).rejects.toThrow();
  });
  it('requires coherent terminal recovery facts', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      code: 0,
      data: { ...receipt, status: 'succeeded', error_code: null },
    });
    expect((await bookmarksApi.resolve(operationId)).status).toBe('succeeded');
    vi.mocked(request).mockResolvedValueOnce({
      code: 0,
      data: {
        operation_id: operationId,
        kind: null,
        resource_id: null,
        changed_count: 0,
        status: 'not_executed',
        error_code: null,
      },
    });
    expect((await bookmarksApi.resolve(operationId)).status).toBe('not_executed');
  });
  it.each([
    { status: 'running', kind: 'bookmark_create', resource_id: resourceId, changed_count: 1 },
    { status: 'succeeded', kind: 'unknown', resource_id: resourceId, changed_count: 1 },
    { status: 'not_executed', kind: null, resource_id: resourceId, changed_count: 0 },
    { status: 'succeeded', kind: 'bookmark_create', resource_id: resourceId, changed_count: 0 },
    { status: 'failed', kind: 'bookmark_create', resource_id: null, changed_count: 0 },
  ])('rejects invalid recovery combinations: $status/$kind', async (dto) => {
    vi.mocked(request).mockResolvedValue({
      code: 0,
      data: { operation_id: operationId, error_code: null, ...dto },
    });
    await expect(bookmarksApi.resolve(operationId)).rejects.toThrow();
  });
});
