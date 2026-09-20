export { ShareDialog } from './ui/ShareDialog';
export type { ShareDialogProps, SharePosterStatus } from './ui/ShareDialog';
export { useShareActions } from './model/useShareActions';
export type { UseShareActionsOptions } from './model/useShareActions';
export {
  buildShareCopy,
  buildShareFullText,
  buildPlatformShareText,
  buildNativeShareText,
  buildShareTextBundle,
  SHARE_COPY_MAX_LENGTH,
} from './model/share-copy';
export { buildShareLandingUrl } from './model/share-url';
export type { ShareLandingUrlOptions } from './model/share-url';
export { ShareError, isShareError, normalizeShareError } from './model/share.errors';
export type { ShareErrorCode } from './model/share.errors';
export { SHARE_PLATFORMS, SHARE_ACTION_LABEL_KEYS } from './model/share.types';
export type {
  ShareActionName,
  ShareActionDescriptor,
  ShareActionLabelKey,
  ShareActionPlacement,
  ShareCapabilities,
  ShareContent,
  ShareFeedback,
  SharePlatform,
  ShareSurface,
} from './model/share.types';
export { captureSharePoster } from './adapter/share-poster.capture';
export type { CaptureSharePosterOptions } from './adapter/share-poster.capture';
export { detectShareCapabilities, getShareActionDescriptors } from './adapter/share.capabilities';
export type { DetectShareCapabilitiesOptions } from './adapter/share.capabilities';
export {
  buildPlatformShareUrl,
  fitPlatformShareText,
  SHARE_PLATFORM_LIMITS,
} from './adapter/share.dispatch';
