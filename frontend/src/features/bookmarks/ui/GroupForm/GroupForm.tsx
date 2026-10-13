import { useEffect, useRef, useState } from 'react';
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
import { Input } from '../../../../shared/ui/input';
import { Label } from '../../../../shared/ui/label';
import type { BookmarkGroup } from '../../model/bookmarks.types';
import {
  bookmarkErrorKey,
  groupNameError,
  validateGroupName,
} from '../../model/bookmarks.validation';

type GroupFormProps = {
  open: boolean;
  name: string;
  groupId?: string;
  groups: BookmarkGroup[];
  isBlocked: boolean;
  isPending: boolean;
  isUnknown: boolean;
  isResolving: boolean;
  error: unknown;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
  onSubmit: (name: string) => void;
  onResolve: () => void;
};

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

export function GroupForm({
  open,
  name,
  groupId,
  groups,
  isBlocked,
  isPending,
  isUnknown,
  isResolving,
  error,
  onNameChange,
  onOpenChange,
  onRestoreFocus,
  onSubmit,
  onResolve,
}: GroupFormProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fieldError = localError ?? groupNameError(error);
  useEffect(() => {
    if (groupNameError(error)) inputRef.current?.focus();
  }, [error]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('bookmarks.close')}
        className="max-h-[calc(100dvh-var(--space-8))] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t(groupId ? 'bookmarks.renameGroup' : 'bookmarks.createGroup')}
          </DialogTitle>
          <DialogDescription>
            {t(groupId ? 'bookmarks.renameGroupDescription' : 'bookmarks.createGroupDescription')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-[var(--space-4)]"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (isBlocked) return;
            const trimmed = name.trim();
            const invalid =
              validateGroupName(trimmed) ??
              (groups.some(
                (group) =>
                  group.id !== groupId && asciiLower(group.name.trim()) === asciiLower(trimmed),
              )
                ? 'bookmarks.errors.groupDuplicate'
                : null);
            setLocalError(invalid);
            if (invalid) inputRef.current?.focus();
            else onSubmit(trimmed);
          }}
        >
          <div className="space-y-[var(--space-2)]">
            <Label htmlFor="bookmark-group-name">{t('bookmarks.groupName')} *</Label>
            <Input
              ref={inputRef}
              id="bookmark-group-name"
              name="name"
              value={name}
              disabled={isBlocked}
              aria-invalid={Boolean(fieldError)}
              aria-describedby="bookmark-group-name-hint"
              onChange={(event) => {
                setLocalError(null);
                onNameChange(event.target.value);
              }}
            />
            <p
              id="bookmark-group-name-hint"
              className={fieldError ? 'text-destructive text-sm' : 'text-muted-foreground text-xs'}
            >
              {t(fieldError ?? 'bookmarks.groupNameHint')}
            </p>
          </div>
          {isUnknown ? (
            <div role="status" className="space-y-[var(--space-3)]">
              <p>{t('bookmarks.unknown')}</p>
              <Button type="button" variant="outline" loading={isResolving} onClick={onResolve}>
                {t('bookmarks.resolve')}
              </Button>
            </div>
          ) : error && !isPending && !fieldError ? (
            <p role="alert" className="text-destructive">
              {t(bookmarkErrorKey(error))}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('bookmarks.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isBlocked}
              loading={isPending}
              loadingLabel={isPending ? t('bookmarks.saving') : undefined}
            >
              {t(groupId ? 'bookmarks.saveGroupName' : 'bookmarks.createGroup')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
