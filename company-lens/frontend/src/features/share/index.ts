export { ShareDialog } from './ui/ShareDialog';
export { useShareActions } from './model/useShareActions';
export {
  createApiShareImageUploadAdapter,
  mockShareImageUploadAdapter,
  SHARE_API_PATHS,
} from './api/share.adapters';
export {
  createShareComposition,
  getShareComposition,
  setShareCompositionForTest,
} from './api/share.composition';
export { isShareError, ShareError } from './model/share.errors';
export { extractSharePosterEditorialContent } from './model/share-poster-content';
export {
  buildNativeShareText,
  buildPlatformShareText,
  buildShareCopy,
  buildShareFullText,
  buildShareTextBundle,
  SHARE_COPY_MAX_LENGTH,
} from './model/share-copy';
export { getCurrentPageShareUrl } from './model/share-url';
export type { SharePosterMarkdownSource } from './model/share-poster-content';
export type { ShareErrorCode } from './model/share.errors';
export type {
  ShareActionName,
  ShareCapabilities,
  ShareImageUploadInput,
  ShareLandingCapability,
  SharePayload,
  SharePlatform,
  SharePosterCandidate,
  SharePosterData,
  SharePosterHighlight,
  SharePosterVariant,
  ShareResourceStatus,
  ShareUploadedAsset,
} from './model/share.types';
