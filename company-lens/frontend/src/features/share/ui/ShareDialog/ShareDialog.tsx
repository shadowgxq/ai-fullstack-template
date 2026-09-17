import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Copy, Download, Link2, Loader2, Share2, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { getApiErrorMessage } from '../../../../shared/api';
import { useShareActions, type UseShareActionsResult } from '../../model/useShareActions';
import type {
  ShareActionName,
  ShareCapabilities,
  SharePayload,
  SharePlatform,
} from '../../model/share.types';
import { SharePoster } from './SharePoster';
import styles from './ShareDialog.module.css';

export type ShareDialogProps = {
  open: boolean;
  payload?: SharePayload;
  onOpenChange: (open: boolean) => void;
};

function getSharePreparationKey(payload: SharePayload): string {
  return JSON.stringify(payload);
}

const PLATFORM_LABEL_KEYS = {
  x: 'share.platforms.x',
  reddit: 'share.platforms.reddit',
  telegram: 'share.platforms.telegram',
} as const satisfies Record<SharePlatform, string>;

type GenericShareAction = Extract<
  ShareActionName,
  'native' | 'copy-text' | 'copy-link' | 'download'
>;
type CopyAction = Extract<GenericShareAction, 'copy-text' | 'copy-link'>;
type ShareChannelAction = 'native' | SharePlatform;
type ActionButtonVariant = 'primary' | 'secondary' | 'menu' | 'platform';

const COPY_ACTIONS = ['copy-link', 'copy-text'] as const satisfies readonly CopyAction[];
const PLATFORM_ACTIONS = ['x', 'reddit', 'telegram'] as const satisfies readonly SharePlatform[];
const PLATFORM_ICON_PATHS = {
  x: '/brand-icons/x.svg',
  reddit: '/brand-icons/reddit.svg',
  telegram: '/brand-icons/telegram.svg',
} as const satisfies Record<SharePlatform, string>;

const ACTION_LABEL_KEYS = {
  native: 'share.nativeShare',
  'copy-text': 'share.copyText',
  'copy-link': 'share.copyLink',
  download: 'share.download',
} as const satisfies Record<GenericShareAction, string>;

const HOVER_CLOSE_DELAY_MS = 120;

function useHoverPopover() {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof globalThis.setTimeout>>();
  const triggerHoveredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== undefined) {
        globalThis.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current === undefined) {
      return;
    }
    globalThis.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  };

  const openOnPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    triggerHoveredRef.current = true;
    cancelScheduledClose();
    setOpen(true);
  };

  const openOnContentPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    cancelScheduledClose();
    setOpen(true);
  };

  const closeOnPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      return;
    }
    triggerHoveredRef.current = false;
    cancelScheduledClose();
    closeTimerRef.current = globalThis.setTimeout(() => {
      closeTimerRef.current = undefined;
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  };

  const onOpenChange = (nextOpen: boolean) => {
    cancelScheduledClose();
    if (!nextOpen && triggerHoveredRef.current) {
      return;
    }
    setOpen(nextOpen);
  };

  const closeImmediately = () => {
    triggerHoveredRef.current = false;
    cancelScheduledClose();
    setOpen(false);
  };

  return {
    open,
    onOpenChange,
    openOnPointerEnter,
    openOnContentPointerEnter,
    closeOnPointerLeave,
    closeImmediately,
  };
}

function getAvailableCopyActions(
  isProject: boolean,
  capabilities: ShareCapabilities,
): CopyAction[] {
  if (!capabilities.canCopy) {
    return [];
  }
  return COPY_ACTIONS.filter((action) => action === 'copy-text' || isProject);
}

function getAvailableShareActions(
  isProject: boolean,
  capabilities: ShareCapabilities,
): ShareChannelAction[] {
  const platformActions = PLATFORM_ACTIONS.filter(
    (platform) => !capabilities.isMobile && isProject && capabilities.platforms[platform],
  );
  return capabilities.isMobile && capabilities.canWebShare
    ? ['native', ...platformActions]
    : platformActions;
}

function GenericActionIcon({ action }: { action: GenericShareAction }) {
  switch (action) {
    case 'native':
      return <Share2 size={15} aria-hidden />;
    case 'copy-text':
      return <Copy size={15} aria-hidden />;
    case 'copy-link':
      return <Link2 size={15} aria-hidden />;
    case 'download':
      return <Download size={15} aria-hidden />;
  }
}

function PlatformIcon({ platform }: { platform: SharePlatform }) {
  return (
    <img
      className={styles.platformIcon}
      src={PLATFORM_ICON_PATHS[platform]}
      data-platform={platform}
      alt=""
      aria-hidden
    />
  );
}

function ActionButton({
  action,
  pendingAction,
  onClick,
  children,
  disabled = false,
  variant = 'secondary',
}: {
  action: ShareActionName;
  pendingAction?: ShareActionName;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  variant?: ActionButtonVariant;
}) {
  const isPending = pendingAction === action;
  const className =
    variant === 'primary'
      ? styles.primaryAction
      : variant === 'secondary'
        ? styles.secondaryAction
        : variant === 'platform'
          ? styles.platformMenuAction
          : styles.menuAction;
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled || Boolean(pendingAction)}
      aria-busy={isPending}
      data-action-variant={variant}
    >
      {isPending ? <Loader2 size={15} className={styles.spin} aria-hidden /> : null}
      {children}
    </button>
  );
}

function ShareControl({
  isProject,
  capabilities,
  pendingAction,
  onAction,
}: {
  isProject: boolean;
  capabilities: ShareCapabilities;
  pendingAction?: ShareActionName;
  onAction: (action: ShareChannelAction) => void;
}) {
  const { t } = useTranslation();
  const hoverPopover = useHoverPopover();
  const shareActions = getAvailableShareActions(isProject, capabilities);
  const platformActions = shareActions.filter(
    (action): action is SharePlatform => action !== 'native',
  );
  const hasNativeAction = shareActions.includes('native');
  const isPending = pendingAction
    ? shareActions.includes(pendingAction as ShareChannelAction)
    : false;

  if (shareActions.length === 0) {
    return null;
  }

  if (shareActions.length === 1) {
    const action = shareActions[0];
    return (
      <ActionButton
        action={action}
        pendingAction={pendingAction}
        onClick={() => onAction(action)}
        variant="primary"
      >
        <Share2 size={15} aria-hidden />
        {t('share.open')}
      </ActionButton>
    );
  }

  return (
    <Popover.Root open={hoverPopover.open} onOpenChange={hoverPopover.onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={Boolean(pendingAction)}
          aria-busy={isPending}
          data-action-variant="primary"
          onPointerEnter={hoverPopover.openOnPointerEnter}
          onPointerLeave={hoverPopover.closeOnPointerLeave}
        >
          {isPending ? (
            <Loader2 size={15} className={styles.spin} aria-hidden />
          ) : (
            <Share2 size={15} aria-hidden />
          )}
          {t('share.open')}
          <ChevronDown size={15} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.shareMenu}
          role="group"
          side="top"
          align="start"
          sideOffset={8}
          aria-label={t('share.shareOptionsLabel')}
          onPointerEnter={hoverPopover.openOnContentPointerEnter}
          onPointerLeave={hoverPopover.closeOnPointerLeave}
          onEscapeKeyDown={hoverPopover.closeImmediately}
        >
          <div className={styles.shareMenuActions}>
            {hasNativeAction ? (
              <Popover.Close asChild>
                <ActionButton
                  action="native"
                  pendingAction={pendingAction}
                  onClick={() => onAction('native')}
                  variant="menu"
                >
                  <GenericActionIcon action="native" />
                  {t(ACTION_LABEL_KEYS.native)}
                </ActionButton>
              </Popover.Close>
            ) : null}
            {hasNativeAction && platformActions.length > 0 ? (
              <span className={styles.menuDivider} aria-hidden />
            ) : null}
            {platformActions.length > 0 ? (
              <div className={styles.platformMenuActions}>
                {platformActions.map((platform) => (
                  <Popover.Close key={platform} asChild>
                    <ActionButton
                      action={platform}
                      pendingAction={pendingAction}
                      onClick={() => onAction(platform)}
                      variant="platform"
                    >
                      <PlatformIcon platform={platform} />
                      {t(PLATFORM_LABEL_KEYS[platform])}
                    </ActionButton>
                  </Popover.Close>
                ))}
              </div>
            ) : null}
          </div>
          <Popover.Arrow className={styles.menuArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CopyControl({
  isProject,
  capabilities,
  pendingAction,
  onAction,
}: {
  isProject: boolean;
  capabilities: ShareCapabilities;
  pendingAction?: ShareActionName;
  onAction: (action: CopyAction) => void;
}) {
  const { t } = useTranslation();
  const hoverPopover = useHoverPopover();
  const copyActions = getAvailableCopyActions(isProject, capabilities);
  const isPending = pendingAction ? copyActions.includes(pendingAction as CopyAction) : false;

  if (copyActions.length === 0) {
    return null;
  }

  if (copyActions.length === 1) {
    const action = copyActions[0];
    return (
      <ActionButton
        action={action}
        pendingAction={pendingAction}
        onClick={() => onAction(action)}
        variant="secondary"
      >
        <GenericActionIcon action={action} />
        {t(ACTION_LABEL_KEYS[action])}
      </ActionButton>
    );
  }

  return (
    <Popover.Root open={hoverPopover.open} onOpenChange={hoverPopover.onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={Boolean(pendingAction)}
          aria-busy={isPending}
          data-action-variant="secondary"
          onPointerEnter={hoverPopover.openOnPointerEnter}
          onPointerLeave={hoverPopover.closeOnPointerLeave}
        >
          {isPending ? (
            <Loader2 size={15} className={styles.spin} aria-hidden />
          ) : (
            <Copy size={15} aria-hidden />
          )}
          {t('share.copy')}
          <ChevronDown size={15} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.copyMenu}
          role="group"
          side="top"
          align="start"
          sideOffset={8}
          aria-label={t('share.copyOptionsLabel')}
          onPointerEnter={hoverPopover.openOnContentPointerEnter}
          onPointerLeave={hoverPopover.closeOnPointerLeave}
          onEscapeKeyDown={hoverPopover.closeImmediately}
        >
          <div className={styles.copyMenuActions}>
            {copyActions.map((action) => (
              <Popover.Close key={action} asChild>
                <ActionButton
                  action={action}
                  pendingAction={pendingAction}
                  onClick={() => onAction(action)}
                  variant="menu"
                >
                  <GenericActionIcon action={action} />
                  {t(ACTION_LABEL_KEYS[action])}
                </ActionButton>
              </Popover.Close>
            ))}
          </div>
          <Popover.Arrow className={styles.menuArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const SHARE_TOAST_DURATION_MS = 2600;

function ShareToast({ actions }: { actions: UseShareActionsResult }) {
  const { t } = useTranslation();
  const feedback = actions.feedback;
  const feedbackKind = feedback?.kind;
  const feedbackAction = feedback?.action;
  const errorMessage =
    feedbackKind === 'error' && actions.error ? getApiErrorMessage(actions.error) : '';
  const feedbackMessage =
    feedbackKind === 'error'
      ? `${t('share.feedback.error')}${errorMessage ? ` ${errorMessage}` : ''}`
      : feedbackAction === 'copy-text'
        ? t('share.feedback.copyTextSuccess')
        : feedbackAction === 'copy-link'
          ? t('share.feedback.copyLinkSuccess')
          : t('share.feedback.success');
  const [dismissedFeedback, setDismissedFeedback] = useState<UseShareActionsResult['feedback']>();

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = globalThis.setTimeout(
      () => setDismissedFeedback(feedback),
      SHARE_TOAST_DURATION_MS,
    );
    return () => globalThis.clearTimeout(timer);
  }, [feedback]);

  if (!feedback || dismissedFeedback === feedback || !feedbackKind) {
    return null;
  }

  const toastElement = (
    <div
      className={feedbackKind === 'error' ? styles.toastError : styles.toast}
      role={feedbackKind === 'error' ? 'alert' : 'status'}
      aria-live={feedbackKind === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-share-toast
    >
      {feedbackMessage}
    </div>
  );

  if (typeof document === 'undefined' || !document.body) {
    return toastElement;
  }
  return createPortal(toastElement, document.body);
}

export function ShareDialog({ open, payload, onOpenChange }: ShareDialogProps) {
  const { t } = useTranslation();
  const posterRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const preparationKeyRef = useRef<string>();
  const actions = useShareActions(payload, { open });
  const { preparePoster } = actions;
  const preparationKey = payload ? getSharePreparationKey(payload) : '';

  useEffect(() => {
    if (!open) {
      preparationKeyRef.current = undefined;
      return;
    }

    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      const posterElement = posterRef.current;
      if (cancelled || !payload || !posterElement || preparationKeyRef.current === preparationKey) {
        return;
      }
      preparationKeyRef.current = preparationKey;
      void preparePoster(posterElement);
    }, 0);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [open, payload, preparePoster, preparationKey]);

  useEffect(() => {
    if (open && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, [open, preparationKey]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!payload) {
    return null;
  }

  const isProject = payload.landingCapability === 'project';

  const runShareAction = (action: ShareChannelAction) => {
    if (action === 'native') {
      void actions.nativeShare();
      return;
    }
    void actions.sharePlatform(action);
  };

  const runCopyAction = (action: CopyAction) => {
    switch (action) {
      case 'copy-text':
        void actions.copyText();
        break;
      case 'copy-link':
        void actions.copyLink();
        break;
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <Dialog.Title className={styles.title}>{t('share.title')}</Dialog.Title>
              <Dialog.Description className={styles.description}>
                {t(isProject ? 'share.description.project' : 'share.description.company')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className={styles.close} aria-label={t('share.close')}>
                <X size={18} aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div ref={scrollAreaRef} className={styles.scrollArea} data-share-scroll-area>
            <SharePoster ref={posterRef} poster={payload.poster} />
          </div>

          <div className={styles.actions} data-share-actions>
            <div
              className={styles.actionGroup}
              role="group"
              aria-label={t('share.actionGroupLabel')}
            >
              <ShareControl
                isProject={isProject}
                capabilities={actions.capabilities}
                pendingAction={actions.pendingAction}
                onAction={runShareAction}
              />
              <CopyControl
                isProject={isProject}
                capabilities={actions.capabilities}
                pendingAction={actions.pendingAction}
                onAction={runCopyAction}
              />
              {actions.capabilities.canDownload ? (
                <ActionButton
                  action="download"
                  pendingAction={actions.pendingAction}
                  onClick={() => void actions.downloadImage()}
                  disabled={!actions.previewUrl}
                  variant="secondary"
                >
                  <GenericActionIcon action="download" />
                  {t(ACTION_LABEL_KEYS.download)}
                </ActionButton>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      <ShareToast actions={actions} />
    </Dialog.Root>
  );
}
