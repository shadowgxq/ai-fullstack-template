export { detectShareCapabilities, getShareActionDescriptors } from './adapter/share.capabilities';
export { captureSharePoster } from './adapter/share-poster.capture';
export type { CaptureSharePosterOptions } from './adapter/share-poster.capture';
export { ShareDialog } from './ui/ShareDialog';
export type { ShareDialogProps, SharePosterStatus } from './ui/ShareDialog';
export {
  buildPlatformShareUrl,
  fitPlatformShareText,
  SHARE_PLATFORM_LIMITS,
} from './adapter/share.dispatch';
export {
  buildNativeShareText,
  buildPlatformShareText,
  buildShareCopy,
  buildShareFullText,
  buildShareTextBundle,
  SHARE_COPY_MAX_LENGTH,
} from './model/share-copy';
export { isShareError, ShareError, type ShareErrorCode } from './model/share.errors';
export { buildShareLandingUrl, type ShareLandingUrlOptions } from './model/share-url';
export { useShareActions, type UseShareActionsOptions } from './model/useShareActions';
export type {
  ShareActionDescriptor,
  ShareActionLabelKey,
  ShareActionName,
  ShareActionPlacement,
  ShareCapabilities,
  ShareContent,
  ShareFeedback,
  SharePlatform,
  ShareSurface,
} from './model/share.types';
export { SHARE_ACTION_LABEL_KEYS, SHARE_PLATFORMS } from './model/share.types';
