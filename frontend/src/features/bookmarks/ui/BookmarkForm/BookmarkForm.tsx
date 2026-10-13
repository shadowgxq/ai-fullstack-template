import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../shared/ui/select';
import { Textarea } from '../../../../shared/ui/textarea';
import type {
  BookmarkDraft,
  BookmarkFieldErrors,
  BookmarkGroup,
} from '../../model/bookmarks.types';
import {
  bookmarkFieldErrors,
  bookmarkErrorKey,
  normalizeBookmarkDraft,
  validateBookmark,
} from '../../model/bookmarks.validation';

type BookmarkFormProps = {
  open: boolean;
  isEditing: boolean;
  draft: BookmarkDraft;
  groups: BookmarkGroup[];
  isBlocked: boolean;
  isPending: boolean;
  error: unknown;
  isUnknown: boolean;
  isResolving: boolean;
  onResolve: () => void;
  onRestoreFocus: () => void;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: BookmarkDraft) => void;
  onSubmit: (draft: BookmarkDraft) => void;
};

export function BookmarkForm({
  open,
  isEditing,
  draft,
  groups,
  isBlocked,
  isPending,
  error,
  isUnknown,
  isResolving,
  onResolve,
  onRestoreFocus,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: BookmarkFormProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [localErrors, setLocalErrors] = useState<BookmarkFieldErrors>({});
  const errors = { ...bookmarkFieldErrors(error), ...localErrors };

  useEffect(() => {
    if (error) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isBlocked) return;
    const nextErrors = validateBookmark(draft);
    setLocalErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    else onSubmit(normalizeBookmarkDraft(draft));
  }

  function hint(field: 'title' | 'url' | 'note' | 'group_id', key: string) {
    return (
      <p
        id={`bookmark-${field}-hint`}
        className={errors[field] ? 'text-destructive text-sm' : 'text-muted-foreground text-xs'}
      >
        {t(errors[field] ?? key)}
      </p>
    );
  }

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
          <DialogTitle>{t(isEditing ? 'bookmarks.edit' : 'bookmarks.add')}</DialogTitle>
          <DialogDescription>
            {t(isEditing ? 'bookmarks.editDescription' : 'bookmarks.addDescription')}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-[var(--space-4)]">
          {isUnknown ? (
            <div
              role="status"
              className="bg-warning-subtle space-y-[var(--space-3)] rounded-[var(--radius-control)] p-[var(--space-3)]"
            >
              <p>{t('bookmarks.unknown')}</p>
              <Button type="button" variant="outline" loading={isResolving} onClick={onResolve}>
                {t('bookmarks.resolve')}
              </Button>
            </div>
          ) : error && !isPending ? (
            <p role="alert" className="text-destructive">
              {t(bookmarkErrorKey(error))}
            </p>
          ) : null}
          <div className="space-y-[var(--space-2)]">
            <Label htmlFor="bookmark-title">{t('bookmarks.titleField')} *</Label>
            <Input
              id="bookmark-title"
              name="title"
              value={draft.title}
              aria-invalid={Boolean(errors.title)}
              aria-describedby="bookmark-title-hint"
              disabled={isBlocked}
              onChange={(event) => {
                setLocalErrors({});
                onDraftChange({ ...draft, title: event.target.value });
              }}
            />
            {hint('title', 'bookmarks.titleHint')}
          </div>
          <div className="space-y-[var(--space-2)]">
            <Label htmlFor="bookmark-url">{t('bookmarks.urlField')} *</Label>
            <Input
              id="bookmark-url"
              name="url"
              inputMode="url"
              value={draft.url}
              placeholder="https://"
              aria-invalid={Boolean(errors.url)}
              aria-describedby="bookmark-url-hint"
              disabled={isBlocked}
              onChange={(event) => {
                setLocalErrors({});
                onDraftChange({ ...draft, url: event.target.value });
              }}
            />
            {hint('url', 'bookmarks.urlHint')}
          </div>
          <div className="space-y-[var(--space-2)]">
            <Label htmlFor="bookmark-group">{t('bookmarks.groupField')}</Label>
            <Select
              value={draft.group_id ?? 'ungrouped'}
              disabled={isBlocked}
              onValueChange={(value) =>
                onDraftChange({ ...draft, group_id: value === 'ungrouped' ? null : value })
              }
            >
              <SelectTrigger
                id="bookmark-group"
                name="group_id"
                aria-invalid={Boolean(errors.group_id)}
                aria-describedby="bookmark-group_id-hint"
              >
                <SelectValue />
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
            {hint('group_id', 'bookmarks.groupHint')}
          </div>
          <div className="space-y-[var(--space-2)]">
            <Label htmlFor="bookmark-note">{t('bookmarks.noteField')}</Label>
            <Textarea
              id="bookmark-note"
              name="note"
              value={draft.note}
              aria-invalid={Boolean(errors.note)}
              aria-describedby="bookmark-note-hint"
              disabled={isBlocked}
              onChange={(event) => {
                setLocalErrors({});
                onDraftChange({ ...draft, note: event.target.value });
              }}
            />
            {hint('note', 'bookmarks.noteHint')}
          </div>
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
              {t(isEditing ? 'bookmarks.saveChanges' : 'bookmarks.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
