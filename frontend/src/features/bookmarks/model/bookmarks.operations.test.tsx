import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bookmarksApi } from './bookmarks.api';
import { useBookmarkOperations } from './bookmarks.operations';
import type { BookmarkIntent, MutationResult } from './bookmarks.types';

const resourceId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const draft = {
  title: 'Private title',
  url: 'https://example.com',
  note: 'secret note',
  group_id: null,
};
const input = { kind: 'bookmark_create' as const, draft };

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}
function succeeded(intent: BookmarkIntent): MutationResult {
  return {
    operation_id: intent.operationId,
    kind: intent.kind,
    resource_id: resourceId,
    changed_count: 1,
  };
}

describe('bookmark submission and recovery', () => {
  it.each(['group_create', 'group_rename', 'group_delete', 'batch_move'] as const)(
    'restores a private %s key without storing a name or request payload',
    async (kind) => {
      const operationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      sessionStorage.setItem('bookmarks.recovery.1', JSON.stringify({ operationId, kind }));
      vi.spyOn(bookmarksApi, 'resolve').mockResolvedValue({
        operation_id: operationId,
        kind,
        status: 'succeeded',
        resource_id: kind === 'batch_move' ? null : resourceId,
        changed_count: kind === 'group_delete' || kind === 'batch_move' ? 0 : 1,
        error_code: null,
      });
      const onSucceeded = vi.fn().mockResolvedValue(undefined);
      const hook = renderHook(() => useBookmarkOperations('1', () => true, onSucceeded), {
        wrapper,
      });
      expect(hook.result.current.operation?.kind).toBe(kind);
      await act(async () => {
        await hook.result.current.resolve();
      });
      expect(onSucceeded).toHaveBeenCalledWith({
        operation_id: operationId,
        kind,
        status: 'succeeded',
        resource_id: kind === 'batch_move' ? null : resourceId,
        changed_count: kind === 'group_delete' || kind === 'batch_move' ? 0 : 1,
        error_code: null,
      });
      expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
    },
  );
  it('uses the latest success callback when filters change during a pending mutation', async () => {
    let finish: (result: MutationResult) => void = () => {
      throw new Error('not initialized');
    };
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = vi.fn().mockResolvedValue(undefined);
    const latest = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(({ callback }) => useBookmarkOperations('1', () => true, callback), {
      initialProps: { callback: first },
      wrapper,
    });
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.result.current.submit({ kind: 'group_delete', resourceId, expectedCount: 0 });
    });
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    hook.rerender({ callback: latest });
    await act(async () => {
      finish({ ...succeeded(mutate.mock.calls[0][0]), changed_count: 0 });
      await pending;
    });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });
  it('locks synchronously across repeated submissions and persists no draft or token', async () => {
    let finish: (result: MutationResult) => void = () => {
      throw new Error('not initialized');
    };
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onSucceeded = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useBookmarkOperations('1', () => true, onSucceeded), { wrapper });
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.result.current.submit(input);
      void hook.result.current.submit(input);
    });
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const intent = mutate.mock.calls[0][0];
    expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
      operationId: intent.operationId,
      kind: intent.kind,
    });
    await act(async () => {
      finish(succeeded(intent));
      await pending;
    });
    expect(hook.result.current.operation).toBeNull();
    expect(onSucceeded).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
  });
  it('keeps unknown locked, resolves its original key and permits a new intent only after a terminal result', async () => {
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(new Error('response lost'));
    const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) => ({
      operation_id: operationId,
      kind: null,
      status: 'not_executed',
      resource_id: null,
      changed_count: 0,
      error_code: null,
    }));
    const hook = renderHook(() => useBookmarkOperations('1', () => true, vi.fn()), { wrapper });
    await act(async () => {
      await hook.result.current.submit(input);
    });
    const oldKey = mutate.mock.calls[0][0].operationId;
    expect(hook.result.current.operation?.status).toBe('unknown');
    await act(async () => {
      await hook.result.current.submit(input);
      await hook.result.current.resolve();
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(oldKey);
    expect(hook.result.current.isBlocked).toBe(false);
    await act(async () => {
      await hook.result.current.submit(input);
    });
    expect(mutate.mock.calls[1][0].operationId).not.toBe(oldKey);
  });
  it('retains unknown when resolve itself fails', async () => {
    vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(new Error('timeout'));
    vi.spyOn(bookmarksApi, 'resolve').mockRejectedValue(new Error('offline'));
    const hook = renderHook(() => useBookmarkOperations('1', () => true, vi.fn()), { wrapper });
    await act(async () => {
      await hook.result.current.submit(input);
    });
    await act(async () => {
      await hook.result.current.resolve();
    });
    expect(hook.result.current.isBlocked).toBe(true);
    expect(hook.result.current.operation?.status).toBe('unknown');
  });
  it('restores only the same user recovery and clears failed terminal operations', async () => {
    const operationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    sessionStorage.setItem(
      'bookmarks.recovery.1',
      JSON.stringify({ operationId, kind: 'bookmark_delete' }),
    );
    vi.spyOn(bookmarksApi, 'resolve').mockResolvedValue({
      operation_id: operationId,
      kind: 'bookmark_delete',
      status: 'failed',
      resource_id: null,
      changed_count: 0,
      error_code: 40410,
    });
    const one = renderHook(() => useBookmarkOperations('1', () => true, vi.fn()), { wrapper });
    const two = renderHook(() => useBookmarkOperations('2', () => true, vi.fn()), { wrapper });
    expect(one.result.current.operation?.status).toBe('unknown');
    expect(two.result.current.operation).toBeNull();
    await act(async () => {
      await one.result.current.resolve();
    });
    expect(one.result.current.isBlocked).toBe(false);
  });
  it('ignores late success after account scope changes and keeps its recovery for the old user', async () => {
    let isCurrent = true;
    let finish: (result: MutationResult) => void = () => {
      throw new Error('not initialized');
    };
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onSucceeded = vi.fn();
    const hook = renderHook(() => useBookmarkOperations('1', () => isCurrent, onSucceeded), {
      wrapper,
    });
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.result.current.submit(input);
    });
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    isCurrent = false;
    await act(async () => {
      finish(succeeded(mutate.mock.calls[0][0]));
      await pending;
    });
    expect(onSucceeded).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('bookmarks.recovery.1')).not.toBeNull();
  });
  it('unlocks a trusted field rejection while preserving the error and draft', async () => {
    const failure = {
      __apiError: true,
      message: 'Validation failed',
      messageFromServer: true,
      status: 422,
      code: 42200,
      details: [{ loc: ['body', 'url'], type: 'value_error', msg: 'URL' }],
    };
    vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(failure);
    const hook = renderHook(() => useBookmarkOperations('1', () => true, vi.fn()), { wrapper });
    await act(async () => {
      await hook.result.current.submit(input);
    });
    expect(hook.result.current.isBlocked).toBe(false);
    expect(hook.result.current.error).toEqual(failure);
    expect(draft.title).toBe('Private title');
  });
  it('keeps in-memory recovery when session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    vi.spyOn(bookmarksApi, 'mutate').mockRejectedValue(new Error('timeout'));
    const hook = renderHook(() => useBookmarkOperations('1', () => true, vi.fn()), { wrapper });
    await act(async () => {
      await hook.result.current.submit(input);
    });
    expect(hook.result.current.operation?.status).toBe('unknown');
    expect(hook.result.current.isBlocked).toBe(true);
  });

  it.each(['succeeded', 'blocked'] as const)(
    'preserves new unknown recovery after an unmounted old request returns %s',
    async (lateStatus) => {
      let finish: (result: MutationResult) => void = () => {
        throw new Error('not initialized');
      };
      let reject: (error: unknown) => void = () => {
        throw new Error('not initialized');
      };
      const mutate = vi
        .spyOn(bookmarksApi, 'mutate')
        .mockImplementationOnce(
          () =>
            new Promise((resolve, fail) => {
              finish = resolve;
              reject = fail;
            }),
        )
        .mockRejectedValue(new Error('new response lost'));
      const oldSucceeded = vi.fn().mockResolvedValue(undefined);
      const old = renderHook(() => useBookmarkOperations('1', () => true, oldSucceeded), {
        wrapper,
      });
      let oldPending: Promise<void> = Promise.resolve();
      act(() => {
        oldPending = old.result.current.submit(input);
      });
      await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
      const oldIntent = mutate.mock.calls[0][0];
      old.unmount();

      const resolve = vi.spyOn(bookmarksApi, 'resolve').mockImplementation(async (operationId) =>
        operationId === oldIntent.operationId && lateStatus === 'blocked'
          ? {
              operation_id: operationId,
              kind: null,
              status: 'not_executed',
              resource_id: null,
              changed_count: 0,
              error_code: null,
            }
          : {
              operation_id: operationId,
              kind: 'bookmark_create',
              status: 'succeeded',
              resource_id: resourceId,
              changed_count: 1,
              error_code: null,
            },
      );
      const next = renderHook(
        () => useBookmarkOperations('1', () => true, vi.fn().mockResolvedValue(undefined)),
        { wrapper },
      );
      await act(async () => {
        await next.result.current.resolve();
      });
      expect(resolve).toHaveBeenCalledWith(oldIntent.operationId);
      await act(async () => {
        await next.result.current.submit(input);
      });
      const newIntent = mutate.mock.calls[1][0];
      expect(newIntent.operationId).not.toBe(oldIntent.operationId);
      expect(next.result.current.operation?.status).toBe('unknown');

      await act(async () => {
        if (lateStatus === 'succeeded') finish(succeeded(oldIntent));
        else
          reject({
            __apiError: true,
            message: 'Blocked',
            messageFromServer: true,
            status: 409,
            code: 40913,
          });
        await oldPending;
      });
      expect(oldSucceeded).not.toHaveBeenCalled();
      expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual({
        operationId: newIntent.operationId,
        kind: newIntent.kind,
      });
      next.unmount();
      const restoredSucceeded = vi.fn().mockResolvedValue(undefined);
      const restored = renderHook(() => useBookmarkOperations('1', () => true, restoredSucceeded), {
        wrapper,
      });
      expect(restored.result.current.operation).toEqual({
        operationId: newIntent.operationId,
        kind: newIntent.kind,
        status: 'unknown',
      });
      await act(async () => {
        await restored.result.current.resolve();
      });
      expect(resolve).toHaveBeenLastCalledWith(newIntent.operationId);
      expect(restoredSucceeded).toHaveBeenCalledOnce();
      expect(sessionStorage.getItem('bookmarks.recovery.1')).toBeNull();
    },
  );

  it('only clears the expected recovery key when another instance has replaced the journal', async () => {
    let finish: (result: MutationResult) => void = () => {
      throw new Error('not initialized');
    };
    const mutate = vi.spyOn(bookmarksApi, 'mutate').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const hook = renderHook(
      () => useBookmarkOperations('1', () => true, vi.fn().mockResolvedValue(undefined)),
      { wrapper },
    );
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.result.current.submit(input);
    });
    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    const newer = { operationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', kind: 'bookmark_create' };
    sessionStorage.setItem('bookmarks.recovery.1', JSON.stringify(newer));
    await act(async () => {
      finish(succeeded(mutate.mock.calls[0][0]));
      await pending;
    });
    expect(JSON.parse(sessionStorage.getItem('bookmarks.recovery.1') ?? '{}')).toEqual(newer);
  });
});
