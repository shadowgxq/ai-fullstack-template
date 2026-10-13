import { ExternalLink, MoreHorizontal, StickyNote } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../../shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../shared/ui/tooltip';
import type { Bookmark, BookmarkGroup } from '../../model/bookmarks.types';
import { PageCheckbox } from '../PageCheckbox/PageCheckbox';
import { cn } from '../../../../shared/utils/cn';

type BookmarkListProps = {
  bookmarks: Bookmark[];
  groups: BookmarkGroup[];
  isBlocked: boolean;
  selectedIds: Set<string>;
  isSelectionDisabled: boolean;
  onSelectionChange: (id: string, checked: boolean) => void;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onNote: (bookmark: Bookmark) => void;
};

export function BookmarkList({
  bookmarks,
  groups,
  isBlocked,
  selectedIds,
  isSelectionDisabled,
  onSelectionChange,
  onEdit,
  onDelete,
  onNote,
}: BookmarkListProps) {
  const { t, i18n } = useTranslation();
  return (
    <TooltipProvider>
      <ul className="divide-border-subtle space-y-[var(--space-3)] md:divide-y md:space-y-0">
        {bookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className={cn(
              'border-border-subtle bg-card grid min-w-0 grid-cols-[var(--control-hit-size)_minmax(0,1fr)] gap-[var(--space-3)] rounded-[var(--radius-card)] border p-[var(--space-4)] md:grid-cols-[var(--control-hit-size)_minmax(0,1fr)_160px_auto] md:items-center md:rounded-none md:border-0 md:px-[var(--space-4)]',
              selectedIds.has(bookmark.id) && 'bg-surface-selected',
            )}
          >
            <PageCheckbox
              label={t('bookmarks.selectBookmark', { title: bookmark.title })}
              checked={selectedIds.has(bookmark.id)}
              disabled={isSelectionDisabled}
              onChange={(checked) => onSelectionChange(bookmark.id, checked)}
            />
            <div className="min-w-0">
              <h3 className="text-[length:var(--text-body-size)] leading-[var(--text-body-line)] font-semibold [overflow-wrap:anywhere]">
                {bookmark.title}
              </h3>
              <p
                className="text-muted-foreground mt-[var(--space-1)] truncate text-xs"
                title={bookmark.url}
              >
                {bookmark.url}
              </p>
            </div>
            <div className="text-muted-foreground min-w-0 text-xs max-md:col-start-2">
              <p className="truncate">
                {groups.find((group) => group.id === bookmark.group_id)?.name ??
                  t('bookmarks.ungrouped')}
              </p>
              <time dateTime={bookmark.updated_at}>
                {new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(bookmark.updated_at))}
              </time>
            </div>
            <div className="flex items-center justify-end gap-[var(--space-1)] max-md:col-span-2 max-md:justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[var(--control-hit-size)] min-w-[var(--control-hit-size)]"
                    aria-label={t('bookmarks.viewNote', { title: bookmark.title })}
                    onClick={() => onNote(bookmark)}
                  >
                    <StickyNote aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('bookmarks.noteField')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="min-h-[var(--control-hit-size)] min-w-[var(--control-hit-size)]"
                  >
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('bookmarks.openLink', { title: bookmark.title })}
                    >
                      <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('bookmarks.open')}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[var(--control-hit-size)] min-w-[var(--control-hit-size)]"
                    aria-label={t('bookmarks.moreActions', { title: bookmark.title })}
                    data-bookmark-actions={bookmark.id}
                    disabled={isBlocked}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(bookmark)}>
                    {t('bookmarks.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(bookmark)}>
                    {t('bookmarks.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
    </TooltipProvider>
  );
}
