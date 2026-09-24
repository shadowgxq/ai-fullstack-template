import { useEffect, useRef, useState } from 'react';

import type { QueryComposerRemoteSearch, QueryComposerSearchStatus } from './query-composer.types';

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 300;

type QueryComposerSearchState<TItem> = Readonly<{
  items: readonly TItem[];
  query: string;
  queryRevision: number;
  retryKey: number;
  status: QueryComposerSearchStatus;
}>;

const IDLE_SEARCH_STATE = {
  items: [],
  query: '',
  queryRevision: 0,
  retryKey: 0,
  status: 'idle',
} as const;

export function useQueryComposerSearch<TItem>(
  query: string,
  config: QueryComposerRemoteSearch<TItem> | undefined,
  isDisabled: boolean,
  queryRevision: number,
) {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<QueryComposerSearchState<TItem>>(IDLE_SEARCH_STATE);
  const requestSequenceRef = useRef(0);
  const normalizedQuery = query.trim();
  const search = config?.search;
  const onError = config?.onError;
  const minChars = config?.minChars ?? DEFAULT_MIN_CHARS;
  const debounceMs = config?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxResults = config?.maxResults;
  const shouldSearch = config?.shouldSearch;
  const isEligible =
    Boolean(search) &&
    !isDisabled &&
    Array.from(normalizedQuery).length >= minChars &&
    (shouldSearch?.(normalizedQuery) ?? true);

  useEffect(() => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    if (!search || !isEligible) {
      return undefined;
    }

    const controller = new AbortController();
    let isActive = true;
    const timer = window.setTimeout(
      () => {
        setState({
          items: [],
          query: normalizedQuery,
          queryRevision,
          retryKey,
          status: 'loading',
        });
        void Promise.resolve()
          .then(() => search(normalizedQuery, { signal: controller.signal }))
          .then(
            (items) => {
              if (!isActive || requestSequence !== requestSequenceRef.current) return;
              const visibleItems =
                maxResults === undefined ? items : items.slice(0, Math.max(0, maxResults));
              setState({
                items: visibleItems,
                query: normalizedQuery,
                queryRevision,
                retryKey,
                status: visibleItems.length > 0 ? 'ready' : 'empty',
              });
            },
            (error: unknown) => {
              if (!isActive || controller.signal.aborted) return;
              onError?.(error, normalizedQuery);
              setState({
                items: [],
                query: normalizedQuery,
                queryRevision,
                retryKey,
                status: 'error',
              });
            },
          );
      },
      Math.max(0, debounceMs),
    );

    return () => {
      isActive = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    debounceMs,
    isEligible,
    maxResults,
    normalizedQuery,
    onError,
    queryRevision,
    retryKey,
    search,
  ]);

  const isCurrentQuery =
    state.query === normalizedQuery &&
    state.queryRevision === queryRevision &&
    state.retryKey === retryKey;

  return {
    items: isEligible && isCurrentQuery ? state.items : [],
    isEligible,
    minChars,
    retry: () => setRetryKey((currentKey) => currentKey + 1),
    status: !isEligible ? 'idle' : isCurrentQuery ? state.status : 'loading',
  } as const;
}
