import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../../shared/ui/button';
import { Input } from '../../../../shared/ui/input';

export function BookmarkSearch({ q, onSearch }: { q: string; onSearch: (q: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(q);
  return (
    <form
      role="search"
      className="flex min-w-0 gap-[var(--space-2)]"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Input
          value={draft}
          aria-label={t('bookmarks.searchLabel')}
          placeholder={t('bookmarks.searchPlaceholder')}
          className="pr-12 max-md:min-h-[var(--control-hit-size)]"
          onChange={(event) => setDraft(event.target.value)}
        />
        {draft || q ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute top-0 right-0 min-h-[var(--control-hit-size)] min-w-[var(--control-hit-size)]"
            aria-label={t('bookmarks.clearSearch')}
            onClick={() => {
              setDraft('');
              onSearch('');
            }}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <Button type="submit" variant="outline" className="max-md:min-h-[var(--control-hit-size)]">
        <Search size={16} aria-hidden="true" />
        {t('bookmarks.search')}
      </Button>
    </form>
  );
}
