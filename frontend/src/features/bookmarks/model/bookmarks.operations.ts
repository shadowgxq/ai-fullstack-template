import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { bookmarksApi } from './bookmarks.api';
import type {
  BookmarkIntent,
  BookmarkKind,
  MutationResult,
  OperationResult,
} from './bookmarks.types';
import { isBookmarkKind, isTerminalBookmarkError, isUuid } from './bookmarks.validation';

type Recovery = { operationId: string; kind: BookmarkKind };
type Operation = Recovery & { status: 'pending' | 'unknown' };
const recoveryKey = (userId: string) => `bookmarks.recovery.${userId}`;

function readRecovery(userId: string): Operation | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(recoveryKey(userId)) ?? 'null');
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('operationId' in raw) ||
      !isUuid(raw.operationId) ||
      !('kind' in raw)
    )
      return null;
    const kind = raw.kind;
    if (!isBookmarkKind(kind)) return null;
    return { operationId: raw.operationId, kind, status: 'unknown' };
  } catch {
    return null;
  }
}

function storeRecovery(userId: string, operation: Recovery): void {
  try {
    sessionStorage.setItem(
      recoveryKey(userId),
      JSON.stringify({ operationId: operation.operationId, kind: operation.kind }),
    );
  } catch {
    // Private browsing may disable storage; in-memory recovery still works.
  }
}

function clearRecovery(userId: string, expectedOperationId: string): void {
  try {
    // Another mounted workspace may already own a newer recovery record.
    if (readRecovery(userId)?.operationId === expectedOperationId)
      sessionStorage.removeItem(recoveryKey(userId));
  } catch {
    // Storage failure must not turn a confirmed result into an uncertain write.
  }
}

export function useBookmarkOperations(
  userId: string,
  isCurrentSession: () => boolean,
  onSucceeded: (result: MutationResult | OperationResult) => Promise<void>,
  onFailed?: (kind: BookmarkKind) => Promise<void>,
) {
  const [operation, setOperation] = useState<Operation | null>(() => readRecovery(userId));
  const [error, setError] = useState<unknown>(null);
  const [errorGeneration, setErrorGeneration] = useState(0);
  const submissionLock = useRef(Boolean(operation));
  const resolveLock = useRef(false);
  const activeOperationId = useRef(operation?.operationId ?? null);
  const instance = useRef({ isAlive: true, epoch: 0 });
  const onSucceededRef = useRef(onSucceeded);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onSucceededRef.current = onSucceeded;
  }, [onSucceeded]);
  useEffect(() => {
    onFailedRef.current = onFailed;
  }, [onFailed]);

  useEffect(() => {
    const lifecycle = instance.current;
    const epoch = ++lifecycle.epoch;
    lifecycle.isAlive = true;
    return () => {
      if (lifecycle.epoch === epoch) {
        lifecycle.isAlive = false;
        lifecycle.epoch++;
      }
    };
  }, []);

  function isActive(epoch: number): boolean {
    return instance.current.isAlive && instance.current.epoch === epoch && isCurrentSession();
  }
  const write = useMutation({
    mutationFn: (intent: BookmarkIntent) => bookmarksApi.mutate(intent),
    retry: false,
  });
  const resolution = useMutation({
    mutationFn: (id: string) => bookmarksApi.resolve(id),
    retry: false,
  });

  function terminal(expectedOperationId: string): void {
    if (activeOperationId.current !== expectedOperationId) return;
    clearRecovery(userId, expectedOperationId);
    activeOperationId.current = null;
    submissionLock.current = false;
    setOperation(null);
  }

  async function submit(input: Omit<BookmarkIntent, 'operationId'>): Promise<void> {
    const epoch = instance.current.epoch;
    if (submissionLock.current || !isActive(epoch)) return;
    submissionLock.current = true;
    const intent = { ...input, operationId: crypto.randomUUID() };
    activeOperationId.current = intent.operationId;
    storeRecovery(userId, intent);
    setError(null);
    setOperation({ operationId: intent.operationId, kind: intent.kind, status: 'pending' });
    let result: MutationResult;
    try {
      result = await write.mutateAsync(intent);
      if (!isActive(epoch)) return;
      if (result.kind !== intent.kind) throw new Error('Mismatched operation receipt');
    } catch (failure) {
      if (!isActive(epoch)) return;
      setError(failure);
      setErrorGeneration((generation) => generation + 1);
      if (isTerminalBookmarkError(failure)) {
        terminal(intent.operationId);
        await onFailedRef.current?.(intent.kind);
      } else
        setOperation({ operationId: intent.operationId, kind: intent.kind, status: 'unknown' });
      return;
    }
    terminal(intent.operationId);
    await onSucceededRef.current(result);
  }

  async function resolve(): Promise<void> {
    const epoch = instance.current.epoch;
    if (!operation || operation.status !== 'unknown' || resolveLock.current || !isActive(epoch))
      return;
    resolveLock.current = true;
    let result: OperationResult;
    try {
      result = await resolution.mutateAsync(operation.operationId);
      if (!isActive(epoch)) return;
      if (result.kind !== null && result.kind !== operation.kind)
        throw new Error('Mismatched operation resolution');
    } catch (failure) {
      if (isActive(epoch)) {
        setError(failure);
        setErrorGeneration((generation) => generation + 1);
      }
      return;
    } finally {
      if (isActive(epoch)) resolveLock.current = false;
    }
    if (!isActive(epoch)) return;
    terminal(operation.operationId);
    if (result.status !== 'succeeded') {
      setErrorGeneration((generation) => generation + 1);
      setError({
        __apiError: true,
        message: 'Operation not completed',
        messageFromServer: true,
        code: result.error_code ?? 40913,
      });
      await onFailedRef.current?.(operation.kind);
    } else {
      setError(null);
      await onSucceededRef.current(result);
    }
  }

  return {
    operation,
    error,
    errorGeneration,
    isBlocked: Boolean(operation),
    isBlockedNow: () => submissionLock.current,
    isResolving: resolution.isPending,
    submit,
    resolve,
    clearError: () => setError(null),
  };
}
