import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { useAuthStore, useLoginModal } from '../../features/auth';
import {
  BookmarksWorkspace,
  parseBookmarkFilters,
  type BookmarkFilters,
} from '../../features/bookmarks';
import { AppShell } from '../../widgets/app-shell';
import { BookmarksWelcome } from './BookmarksWelcome';

export function BookmarksPage() {
  const userId = useAuthStore((state) => state.user?.userId);
  const generation = useAuthStore((state) => state.sessionGeneration);
  const token = useAuthStore((state) => state.token);
  const openLogin = useLoginModal((state) => state.openLogin);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const filters = useMemo(() => parseBookmarkFilters(params), [params]);
  const scope = useMemo(() => ({ userId: userId ?? '', generation }), [userId, generation]);
  const isCurrentSession = useCallback(() => {
    const state = useAuthStore.getState();
    return (
      Boolean(state.token) &&
      state.user?.userId === userId &&
      state.sessionGeneration === generation
    );
  }, [userId, generation]);
  const onFiltersChange = useCallback(
    (next: BookmarkFilters, replace = false) => {
      const query = new URLSearchParams();
      if (next.group !== 'all') query.set('group', next.group);
      if (next.q) query.set('q', next.q);
      if (next.page > 1) query.set('page', String(next.page));
      setParams(query, { replace });
    },
    [setParams],
  );

  return (
    <AppShell hideFooter>
      <main
        id="main-content"
        className="mx-auto w-full px-[max(0px,calc((100%-var(--layout-max-width))/2))] outline-none md:px-[max(var(--space-6),calc((100%-var(--layout-max-width))/2))]"
        tabIndex={-1}
      >
        {userId && token ? (
          <BookmarksWorkspace
            key={`${userId}:${generation}`}
            scope={scope}
            filters={filters}
            navigationKey={location.key}
            isCurrentSession={isCurrentSession}
            onFiltersChange={onFiltersChange}
          />
        ) : (
          <BookmarksWelcome onLogin={() => openLogin('bookmarks')} />
        )}
      </main>
    </AppShell>
  );
}
