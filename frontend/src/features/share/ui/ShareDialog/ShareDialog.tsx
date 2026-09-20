import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronDown,
  Clipboard,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  Share2,
  X,
} from '@/shared/icons';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/shared/utils/cn';
import { captureSharePoster } from '../../adapter/share-poster.capture';
import { useShareActions } from '../../model/useShareActions';
import type {
  ShareActionDescriptor,
  ShareActionName,
  ShareContent,
  SharePlatform,
  ShareSurface,
} from '../../model/share.types';

export type SharePosterStatus = 'idle' | 'generating' | 'ready' | 'error';
export type ShareDialogProps = {
  open: boolean;
  content: ShareContent;
  /** The caller owns poster markup; this layer captures it and provides channel actions. */
  poster: ReactNode;
  /** Status for a caller that supplies its own posterFile. */
  posterStatus?: SharePosterStatus;
  onOpenChange: (open: boolean) => void;
  surface?: ShareSurface;
  includeNativeShare?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  closeLabel?: string;
  actionsLabel?: string;
  preparingImageLabel?: ReactNode;
  imageUnavailableLabel?: ReactNode;
  noActionsLabel?: ReactNode;
};
type CopyAction = Extract<ShareActionName, 'copy-text' | 'copy-link' | 'copy-image'>;
type ShareChannelAction = Extract<ShareActionName, 'native' | SharePlatform>;
type ActionButtonVariant = 'primary' | 'secondary' | 'menu' | 'platform';
type ShareChannelDescriptor = Omit<ShareActionDescriptor, 'action'> & {
  action: ShareChannelAction;
};
type PlatformDescriptor = Omit<ShareActionDescriptor, 'action'> & { action: SharePlatform };
type CopyActionDescriptor = Omit<ShareActionDescriptor, 'action'> & { action: CopyAction };
const PLATFORM_ACTIONS = ['x', 'reddit', 'telegram'] as const satisfies readonly SharePlatform[];
const HOVER_CLOSE_DELAY_MS = 120;
const POSTER_CAPTURE_TIMEOUT_MS = 8000;
type PosterCaptureState = Readonly<{ scope: string; status: SharePosterStatus; file?: File }>;

function getPosterCaptureKey(content: ShareContent): string {
  return [
    content.title,
    content.slogan,
    content.result,
    content.fullText,
    content.landingUrl,
    content.imageUrl,
    content.posterFile?.name,
    content.posterFile?.size,
    content.posterFile?.lastModified,
  ].join('\u001f');
}
function createPosterFile(blob: Blob, title: string): File {
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return new File([blob], `${safeTitle || 'share-poster'}.png`, { type: 'image/png' });
}
function isShareChannelAction(action: ShareActionName): action is ShareChannelAction {
  return action === 'native' || PLATFORM_ACTIONS.includes(action as SharePlatform);
}
function isPlatformAction(action: ShareChannelAction): action is SharePlatform {
  return action !== 'native';
}
function isCopyAction(action: ShareActionName): action is CopyAction {
  return action === 'copy-text' || action === 'copy-link' || action === 'copy-image';
}
function isShareChannelDescriptor(
  descriptor: ShareActionDescriptor,
): descriptor is ShareChannelDescriptor {
  return isShareChannelAction(descriptor.action);
}
function isPlatformDescriptor(
  descriptor: ShareChannelDescriptor,
): descriptor is PlatformDescriptor {
  return isPlatformAction(descriptor.action);
}
function isCopyActionDescriptor(
  descriptor: ShareActionDescriptor,
): descriptor is CopyActionDescriptor {
  return isCopyAction(descriptor.action);
}

function useHoverPopover() {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof globalThis.setTimeout>>();
  const triggerHoveredRef = useRef(false);
  useEffect(
    () => () => {
      if (closeTimerRef.current !== undefined) globalThis.clearTimeout(closeTimerRef.current);
    },
    [],
  );
  function cancelScheduledClose() {
    if (closeTimerRef.current === undefined) return;
    globalThis.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  }
  function openOnPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    triggerHoveredRef.current = true;
    cancelScheduledClose();
    setOpen(true);
  }
  function openOnContentPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    cancelScheduledClose();
    setOpen(true);
  }
  function closeOnPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    triggerHoveredRef.current = false;
    cancelScheduledClose();
    closeTimerRef.current = globalThis.setTimeout(() => {
      closeTimerRef.current = undefined;
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }
  function onOpenChange(nextOpen: boolean) {
    cancelScheduledClose();
    if (!nextOpen && triggerHoveredRef.current) return;
    setOpen(nextOpen);
  }
  function closeImmediately() {
    triggerHoveredRef.current = false;
    cancelScheduledClose();
    setOpen(false);
  }
  return {
    open,
    onOpenChange,
    openOnPointerEnter,
    openOnContentPointerEnter,
    closeOnPointerLeave,
    closeImmediately,
  };
}
function ActionIcon({ action }: { action: ShareActionName }) {
  switch (action) {
    case 'native':
      return <Share2 className="size-[var(--icon-size-md)]" aria-hidden="true" />;
    case 'copy-text':
    case 'copy-image':
      return <Clipboard className="size-[var(--icon-size-md)]" aria-hidden="true" />;
    case 'copy-link':
      return <Link2 className="size-[var(--icon-size-md)]" aria-hidden="true" />;
    case 'download-image':
      return <Download className="size-[var(--icon-size-md)]" aria-hidden="true" />;
    default:
      return <ExternalLink className="size-[var(--icon-size-md)]" aria-hidden="true" />;
  }
}
function PlatformIcon({ platform }: { platform: SharePlatform }) {
  return (
    <span
      className="grid size-[var(--popover-tile-icon-box)] place-items-center"
      aria-hidden="true"
    >
      <img
        src={`/brand-icons/${platform}.svg`}
        alt=""
        className={cn(
          'size-[var(--popover-tile-icon-size)] object-contain',
          platform === 'x' && 'dark:invert',
        )}
      />
    </span>
  );
}
function ActionButton({
  action,
  pendingAction,
  onClick,
  children,
  icon,
  disabled = false,
  variant = 'secondary',
  className,
}: {
  action: ShareActionName;
  pendingAction?: ShareActionName;
  onClick: () => void;
  children: ReactNode;
  icon: ReactNode;
  disabled?: boolean;
  variant?: ActionButtonVariant;
  className?: string;
}) {
  const isPending = pendingAction === action;
  const actionClassName =
    variant === 'primary'
      ? 'min-h-[var(--share-action-height)] min-w-[var(--share-action-primary-min-width)] border-transparent'
      : variant === 'secondary'
        ? 'min-h-[var(--share-action-height)] min-w-[var(--share-action-secondary-min-width)]'
        : variant === 'platform'
          ? 'h-auto min-h-[var(--popover-tile-height)] min-w-0 w-full flex-col px-[var(--popover-tile-padding-x)] text-[length:var(--font-size-xs)]'
          : 'min-h-[var(--share-action-height)] min-w-0 w-full justify-start text-left';
  return (
    <Button
      type="button"
      variant={variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : 'ghost'}
      size={variant === 'platform' ? 'sm' : 'default'}
      loading={isPending}
      className={cn(
        actionClassName,
        variant === 'platform' ? 'hover:bg-surface-hover hover:text-foreground' : null,
        variant === 'primary' || variant === 'secondary' ? 'shrink-0' : null,
        className,
      )}
      onClick={onClick}
      disabled={disabled || Boolean(pendingAction && !isPending)}
      data-action-variant={variant}
    >
      {!isPending ? icon : null}
      {children}
    </Button>
  );
}

function ShareControl({
  actions,
  pendingAction,
  onAction,
  includeNativeShare,
}: {
  actions: readonly ShareActionDescriptor[];
  pendingAction?: ShareActionName;
  onAction: (action: ShareChannelAction) => void;
  includeNativeShare: boolean;
}) {
  const { t } = useTranslation();
  const hoverPopover = useHoverPopover();
  const shareActions = actions.filter(
    (descriptor): descriptor is ShareChannelDescriptor =>
      isShareChannelDescriptor(descriptor) &&
      (includeNativeShare || descriptor.action !== 'native'),
  );
  const platformActions = shareActions.filter(isPlatformDescriptor);
  const nativeActions = shareActions.filter(
    (descriptor): descriptor is ShareChannelDescriptor & { action: 'native' } =>
      descriptor.action === 'native',
  );
  const isPending = pendingAction
    ? shareActions.some(({ action }) => action === pendingAction)
    : false;
  if (shareActions.length === 0) return null;
  if (shareActions.length === 1) {
    const descriptor = shareActions[0];
    const isPlatform = isPlatformAction(descriptor.action);
    return (
      <ActionButton
        action={descriptor.action}
        pendingAction={pendingAction}
        onClick={() => onAction(descriptor.action)}
        icon={
          isPlatform ? (
            <Share2 className="size-[var(--icon-size-md)]" aria-hidden="true" />
          ) : (
            <ActionIcon action="native" />
          )
        }
        variant="primary"
      >
        {isPlatform ? t('share.open') : t(descriptor.labelKey)}
      </ActionButton>
    );
  }
  return (
    <Popover open={hoverPopover.open} onOpenChange={hoverPopover.onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="default"
          disabled={Boolean(pendingAction)}
          loading={isPending}
          aria-haspopup="dialog"
          aria-expanded={hoverPopover.open}
          data-action-variant="primary"
          className="min-h-[var(--share-action-height)] min-w-[var(--share-action-primary-min-width)] shrink-0"
          onPointerEnter={hoverPopover.openOnPointerEnter}
          onPointerLeave={hoverPopover.closeOnPointerLeave}
        >
          {!isPending ? <Share2 className="size-[var(--icon-size-md)]" aria-hidden="true" /> : null}
          {t('share.open')}
          <ChevronDown className="size-[var(--icon-size-md)]" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        variant="compact"
        side="top"
        align="end"
        sideOffset={8}
        aria-label={t('share.shareOptionsLabel')}
        onPointerEnter={hoverPopover.openOnContentPointerEnter}
        onPointerLeave={hoverPopover.closeOnPointerLeave}
        onEscapeKeyDown={hoverPopover.closeImmediately}
      >
        {platformActions.length > 0 ? (
          <div className="grid grid-cols-3 gap-[var(--space-1)]">
            {platformActions.map((descriptor) => (
              <ActionButton
                key={descriptor.action}
                action={descriptor.action}
                pendingAction={pendingAction}
                onClick={() => {
                  hoverPopover.closeImmediately();
                  onAction(descriptor.action);
                }}
                icon={<PlatformIcon platform={descriptor.action} />}
                variant="platform"
              >
                {t(descriptor.labelKey)}
              </ActionButton>
            ))}
          </div>
        ) : null}
        {platformActions.length > 0 && nativeActions.length > 0 ? (
          <span
            className="bg-border-subtle my-[var(--space-1)] block h-[var(--control-border-width)]"
            aria-hidden="true"
          />
        ) : null}
        {nativeActions.map((descriptor) => (
          <ActionButton
            key={descriptor.action}
            action={descriptor.action}
            pendingAction={pendingAction}
            onClick={() => {
              hoverPopover.closeImmediately();
              onAction(descriptor.action);
            }}
            icon={<ActionIcon action="native" />}
            variant="menu"
          >
            {t(descriptor.labelKey)}
          </ActionButton>
        ))}
      </PopoverContent>
    </Popover>
  );
}
function CopyControl({
  actions,
  pendingAction,
  onAction,
}: {
  actions: readonly ShareActionDescriptor[];
  pendingAction?: ShareActionName;
  onAction: (action: CopyAction) => void;
}) {
  const { t } = useTranslation();
  const hoverPopover = useHoverPopover();
  const copyActions = actions.filter(isCopyActionDescriptor);
  const isPending = pendingAction
    ? copyActions.some(({ action }) => action === pendingAction)
    : false;
  if (copyActions.length === 0) return null;
  if (copyActions.length === 1) {
    const descriptor = copyActions[0];
    return (
      <ActionButton
        action={descriptor.action}
        pendingAction={pendingAction}
        onClick={() => onAction(descriptor.action)}
        icon={<ActionIcon action={descriptor.action} />}
        variant="secondary"
      >
        {t(descriptor.labelKey)}
      </ActionButton>
    );
  }
  return (
    <Popover open={hoverPopover.open} onOpenChange={hoverPopover.onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(pendingAction)}
          loading={isPending}
          aria-haspopup="dialog"
          aria-expanded={hoverPopover.open}
          data-action-variant="secondary"
          className="min-h-[var(--share-action-height)] min-w-[var(--share-action-secondary-min-width)] shrink-0"
          onPointerEnter={hoverPopover.openOnPointerEnter}
          onPointerLeave={hoverPopover.closeOnPointerLeave}
        >
          {!isPending ? (
            <Clipboard className="size-[var(--icon-size-md)]" aria-hidden="true" />
          ) : null}
          {t('share.copy')}
          <ChevronDown className="size-[var(--icon-size-md)]" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        variant="compact"
        side="top"
        align="end"
        sideOffset={8}
        aria-label={t('share.copyOptionsLabel')}
        onPointerEnter={hoverPopover.openOnContentPointerEnter}
        onPointerLeave={hoverPopover.closeOnPointerLeave}
        onEscapeKeyDown={hoverPopover.closeImmediately}
      >
        <div className="grid gap-[var(--space-1)]">
          {copyActions.map((descriptor) => (
            <ActionButton
              key={descriptor.action}
              action={descriptor.action}
              pendingAction={pendingAction}
              onClick={() => {
                hoverPopover.closeImmediately();
                onAction(descriptor.action);
              }}
              icon={<ActionIcon action={descriptor.action} />}
              variant="menu"
            >
              {t(descriptor.labelKey)}
            </ActionButton>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
function getFeedbackText(share: ReturnType<typeof useShareActions>, t: (key: string) => string) {
  if (share.error) return t(`share.errors.${share.error.code}`);
  if (!share.feedback) return null;
  if (share.feedback.action === 'native') return t('share.feedback.shared');
  if (
    share.feedback.action === 'x' ||
    share.feedback.action === 'reddit' ||
    share.feedback.action === 'telegram'
  )
    return t('share.feedback.opened');
  if (share.feedback.action === 'download-image') return t('share.feedback.downloaded');
  return t('share.feedback.copied');
}

export function ShareDialog({
  open,
  content,
  poster,
  posterStatus = 'ready',
  onOpenChange,
  surface,
  includeNativeShare = false,
  title,
  description,
  closeLabel,
  actionsLabel,
  preparingImageLabel,
  imageUnavailableLabel,
  noActionsLabel,
}: ShareDialogProps) {
  const { t } = useTranslation();
  const posterRef = useRef<HTMLDivElement>(null);
  const captureRequestRef = useRef(0);
  const captureScope = useMemo(() => getPosterCaptureKey(content), [content]);
  const [posterCapture, setPosterCapture] = useState<PosterCaptureState>({
    scope: '',
    status: 'idle',
  });
  useEffect(() => {
    if (!open || content.posterFile) return undefined;
    const requestId = captureRequestRef.current + 1;
    captureRequestRef.current = requestId;
    const timer = globalThis.setTimeout(() => {
      if (captureRequestRef.current !== requestId) return;
      setPosterCapture({ scope: captureScope, status: 'generating' });
      const target = posterRef.current;
      if (!target) {
        if (captureRequestRef.current === requestId)
          setPosterCapture({ scope: captureScope, status: 'error' });
        return;
      }
      void captureSharePoster(target, { pixelRatio: 2, timeoutMs: POSTER_CAPTURE_TIMEOUT_MS }).then(
        (blob) => {
          if (captureRequestRef.current !== requestId) return;
          setPosterCapture({
            scope: captureScope,
            status: 'ready',
            file: createPosterFile(blob, content.title),
          });
        },
        () => {
          if (captureRequestRef.current === requestId)
            setPosterCapture({ scope: captureScope, status: 'error' });
        },
      );
    }, 0);
    return () => {
      globalThis.clearTimeout(timer);
      captureRequestRef.current += 1;
    };
  }, [captureScope, content.posterFile, content.title, open]);
  const capturedPosterFile = posterCapture.scope === captureScope ? posterCapture.file : undefined;
  const shareContent = useMemo(
    () =>
      content.posterFile || !capturedPosterFile
        ? content
        : { ...content, posterFile: capturedPosterFile },
    [capturedPosterFile, content],
  );
  const share = useShareActions(shareContent, { surface });
  const shareActions = share.actions.filter(
    (descriptor) =>
      isShareChannelDescriptor(descriptor) &&
      (includeNativeShare || descriptor.action !== 'native'),
  );
  const copyActions = share.actions.filter(isCopyActionDescriptor);
  const downloadAction = share.actions.find(({ action }) => action === 'download-image');
  function runAction(action: ShareActionName) {
    switch (action) {
      case 'native':
        return share.nativeShare();
      case 'x':
      case 'reddit':
      case 'telegram':
        return share.sharePlatform(action);
      case 'copy-text':
        return share.copyText();
      case 'copy-link':
        return share.copyLink();
      case 'copy-image':
        return share.copyImage();
      case 'download-image':
        return share.downloadImage();
    }
  }
  const feedback = getFeedbackText(share, t);
  const imageStatus: SharePosterStatus = content.posterFile
    ? (posterStatus ?? 'ready')
    : open
      ? posterCapture.scope === captureScope
        ? posterCapture.status
        : 'generating'
      : 'idle';
  const imageIsPreparing = imageStatus === 'generating';
  const imageIsUnavailable = imageStatus === 'error';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        size="lg"
        variant="flush"
        closeLabel={closeLabel ?? t('share.close')}
        className="max-h-[calc(100dvh-var(--space-8))] max-[720px]:bottom-0 max-[720px]:top-auto max-[720px]:translate-y-0 max-[720px]:rounded-b-none"
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-[var(--space-4)] border-b border-border-subtle px-[var(--dialog-padding)] py-[var(--dialog-padding)]">
          <div className="min-w-0">
            <DialogTitle>{title ?? t('share.title')}</DialogTitle>
            <DialogDescription className="mt-[var(--space-1)]">
              {description ?? t('share.description')}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={closeLabel ?? t('share.close')}
            >
              <X className="size-[var(--icon-size-md)]" aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody
          className="min-h-0 flex-1 overflow-y-auto bg-muted/25 p-[var(--space-4)] sm:p-[var(--space-6)]"
          data-share-scroll-area
        >
          <div ref={posterRef} className="mx-auto w-full" data-share-poster>
            {poster}
          </div>
        </DialogBody>
        <DialogFooter className="mt-0 shrink-0 flex-col border-t border-border-subtle bg-popover px-[var(--dialog-padding)] pt-[var(--space-4)] pb-[var(--dialog-padding)] sm:flex-row sm:items-center sm:justify-between">
          {imageIsPreparing ? (
            <p
              className="text-muted-foreground mb-[var(--space-3)] flex items-center gap-[var(--button-gap)] text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)]"
              role="status"
            >
              <LoaderCircle
                className="size-[var(--icon-size-md)] animate-spin"
                aria-hidden="true"
              />
              {preparingImageLabel ?? t('share.preparingImage')}
            </p>
          ) : imageIsUnavailable ? (
            <p
              className="text-destructive mb-[var(--space-3)] text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)]"
              role="alert"
            >
              {imageUnavailableLabel ?? t('share.imageUnavailable')}
            </p>
          ) : null}
          <div className="flex w-full flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
            {feedback ? (
              <p
                className={cn(
                  'shrink-0 text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)]',
                  share.error ? 'text-destructive' : 'text-success',
                )}
                role={share.error ? 'alert' : 'status'}
              >
                {share.error ? (
                  feedback
                ) : (
                  <>
                    <Check
                      className="mr-[var(--space-1)] inline size-[var(--icon-size-md)]"
                      aria-hidden="true"
                    />
                    {feedback}
                  </>
                )}
              </p>
            ) : null}
            <div
              className="flex flex-col justify-end gap-[var(--button-gap)] sm:ml-auto sm:flex-row sm:items-center"
              role="group"
              aria-label={actionsLabel ?? t('share.actionsLabel')}
              data-share-actions
            >
              <ShareControl
                actions={shareActions}
                pendingAction={share.pendingAction}
                onAction={(action) => void runAction(action)}
                includeNativeShare={includeNativeShare}
              />
              <CopyControl
                actions={copyActions}
                pendingAction={share.pendingAction}
                onAction={(action) => void runAction(action)}
              />
              {downloadAction ? (
                <ActionButton
                  action="download-image"
                  pendingAction={share.pendingAction}
                  onClick={() => void runAction('download-image')}
                  icon={<Download className="size-[var(--icon-size-md)]" aria-hidden="true" />}
                  variant="secondary"
                >
                  {t(downloadAction.labelKey)}
                </ActionButton>
              ) : null}
              {shareActions.length === 0 && copyActions.length === 0 && !downloadAction ? (
                <p className="text-muted-foreground text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)]">
                  {imageIsPreparing
                    ? (preparingImageLabel ?? t('share.preparingImage'))
                    : (noActionsLabel ?? t('share.noActions'))}
                </p>
              ) : null}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
