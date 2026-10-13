import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../../shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu';
import type { BookmarkGroup } from '../../model/bookmarks.types';

type GroupMenuProps = {
  group: BookmarkGroup | null;
  isBlocked: boolean;
  isMobile?: boolean;
  onCreate: () => void;
  onRename: (group: BookmarkGroup) => void;
  onDelete: (group: BookmarkGroup) => void;
  onFocusTarget: (element: HTMLButtonElement) => void;
};

export function GroupMenu({
  group,
  isBlocked,
  isMobile = false,
  onCreate,
  onRename,
  onDelete,
  onFocusTarget,
}: GroupMenuProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={isMobile ? 'outline' : 'ghost'}
          size={isMobile ? 'default' : 'icon'}
          className="min-h-[var(--control-hit-size)] min-w-[var(--control-hit-size)]"
          disabled={isBlocked}
          aria-label={
            isMobile
              ? t('bookmarks.manageGroups')
              : t('bookmarks.groupActions', { name: group?.name })
          }
          onPointerDown={(event) => onFocusTarget(event.currentTarget)}
          onKeyDown={(event) => onFocusTarget(event.currentTarget)}
        >
          {isMobile ? t('bookmarks.manageGroups') : <MoreHorizontal aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {group ? <DropdownMenuLabel>{group.name}</DropdownMenuLabel> : null}
        {isMobile ? (
          <DropdownMenuItem onSelect={onCreate}>{t('bookmarks.createGroup')}</DropdownMenuItem>
        ) : null}
        {group ? (
          <>
            <DropdownMenuItem onSelect={() => onRename(group)}>
              {t('bookmarks.renameGroup')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(group)}>
              {t('bookmarks.deleteGroup')}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>{t('bookmarks.selectGroupToManage')}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
