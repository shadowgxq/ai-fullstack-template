import { useTranslation } from 'react-i18next';

import { Button } from '../../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../shared/ui/dialog';
import type { Bookmark, BookmarkGroup } from '../../model/bookmarks.types';
import { bookmarkErrorKey } from '../../model/bookmarks.validation';

type DeleteConfirmationProps = {
  open: boolean;
  isBlocked: boolean;
  isPending: boolean;
  isUnknown: boolean;
  isResolving: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
  onConfirm: () => void;
  onResolve: () => void;
} & (
  | { kind: 'bookmark'; target: Bookmark }
  | {
      kind: 'group';
      target: BookmarkGroup;
      impact: {
        isLoading: boolean;
        needsRefresh: boolean;
        hasRefreshed: boolean;
        isUnavailable: boolean;
        hasError: boolean;
      };
      onRefreshImpact: () => void;
    }
);

export function DeleteConfirmation(props: DeleteConfirmationProps) {
  const { t } = useTranslation();
  const requiresImpact =
    props.kind === 'group' && (props.impact.needsRefresh || props.impact.isUnavailable);
  const isImpactLoading = props.kind === 'group' && props.impact.isLoading;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        type="danger"
        closeLabel={t('bookmarks.close')}
        className="max-h-[calc(100dvh-var(--space-8))] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          props.onRestoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {props.kind === 'group'
              ? t('bookmarks.deleteGroupTitle', { name: props.target.name })
              : t('bookmarks.deleteTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(
              props.kind === 'group'
                ? 'bookmarks.deleteGroupDescription'
                : 'bookmarks.deleteDescription',
            )}
          </DialogDescription>
        </DialogHeader>
        {props.kind === 'group' ? (
          <p>{t('bookmarks.deleteGroupImpact', { count: props.target.count })}</p>
        ) : (
          <div className="min-w-0 space-y-[var(--space-3)]">
            <p className="font-semibold [overflow-wrap:anywhere]">{props.target.title}</p>
            <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
              {props.target.url}
            </p>
            <p className="text-sm">{t('bookmarks.deleteGroupKept')}</p>
          </div>
        )}
        {props.kind === 'group' && props.impact.hasError ? (
          <p role="alert" className="text-destructive">
            {t('bookmarks.impactRefreshFailed')}
          </p>
        ) : null}
        {props.isUnknown ? (
          <div role="status" className="space-y-[var(--space-3)]">
            <p>{t('bookmarks.unknown')}</p>
            <Button
              type="button"
              variant="outline"
              loading={props.isResolving}
              onClick={props.onResolve}
            >
              {t('bookmarks.resolve')}
            </Button>
          </div>
        ) : props.kind === 'group' && requiresImpact ? (
          <div role="alert" className="space-y-[var(--space-3)]">
            <p className="text-destructive">
              {t(
                props.impact.isUnavailable
                  ? 'bookmarks.errors.unavailable'
                  : 'bookmarks.errors.groupCountChanged',
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              loading={isImpactLoading}
              onClick={props.onRefreshImpact}
            >
              {t('bookmarks.refreshGroupImpact')}
            </Button>
          </div>
        ) : props.kind === 'group' && props.impact.hasRefreshed ? (
          <p role="status">{t('bookmarks.confirmLatestImpact')}</p>
        ) : props.error && !props.isPending ? (
          <p role="alert" className="text-destructive">
            {t(bookmarkErrorKey(props.error))}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {t('bookmarks.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={props.isBlocked || requiresImpact || isImpactLoading}
            loading={props.isPending}
            onClick={props.onConfirm}
          >
            {t(props.kind === 'group' ? 'bookmarks.deleteGroup' : 'bookmarks.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
