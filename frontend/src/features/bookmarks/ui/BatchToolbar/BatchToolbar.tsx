import { useTranslation } from 'react-i18next';
import { Button } from '../../../../shared/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../shared/ui/select';
import type { BookmarkGroup } from '../../model/bookmarks.types';

type BatchToolbarProps = {
  count: number;
  groups: BookmarkGroup[];
  target: string;
  targetName?: string;
  disabled: boolean;
  isCancelDisabled: boolean;
  isPending: boolean;
  canMove: boolean;
  onTargetChange: (target: string) => void;
  onMove: () => void;
  onCancel: () => void;
};

export function BatchToolbar({
  count,
  groups,
  target,
  targetName,
  disabled,
  isCancelDisabled,
  isPending,
  canMove,
  onTargetChange,
  onMove,
  onCancel,
}: BatchToolbarProps) {
  const { t } = useTranslation();
  const label =
    targetName ??
    (target === 'ungrouped'
      ? t('bookmarks.ungrouped')
      : (groups.find((group) => group.id === target)?.name ?? t('bookmarks.unavailableGroup')));
  return (
    <div
      role="group"
      aria-label={t('bookmarks.batchControls')}
      className="bg-surface-selected flex flex-col gap-[var(--space-3)] rounded-[var(--radius-control)] p-[var(--space-4)] md:flex-row md:items-center md:gap-[var(--space-4)]"
    >
      <p aria-live="polite" className="flex-1 text-sm">
        {t('bookmarks.selectedCount', { count })}
      </p>
      <div className="space-y-[var(--space-1)] md:w-[200px]">
        <p className="text-sm font-medium md:sr-only">{t('bookmarks.moveTarget')}</p>
        <Select value={target} disabled={disabled} onValueChange={onTargetChange}>
          <SelectTrigger
            aria-label={t('bookmarks.moveTarget')}
            className="min-h-[var(--control-hit-size)]"
          >
            <SelectValue>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ungrouped">{t('bookmarks.ungrouped')}</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        aria-label={t('bookmarks.moveCount', { count })}
        disabled={!canMove || disabled}
        loading={isPending}
        onClick={onMove}
        className="max-md:w-full max-md:min-h-[var(--control-hit-size)]"
      >
        <span className="max-md:hidden">{t('bookmarks.moveSelected')}</span>
        <span className="md:hidden">{t('bookmarks.moveCount', { count })}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={isCancelDisabled}
        onClick={onCancel}
        className="max-md:w-full max-md:min-h-[var(--control-hit-size)]"
      >
        {t('bookmarks.cancelSelection')}
      </Button>
    </div>
  );
}
