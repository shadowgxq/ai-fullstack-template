export const SHARE_PLATFORMS = ['x', 'reddit', 'telegram'] as const;
export type SharePlatform = (typeof SHARE_PLATFORMS)[number];
export type ShareSurface = 'h5' | 'desktop';
export type ShareActionName =
  | 'native'
  | SharePlatform
  | 'copy-text'
  | 'copy-link'
  | 'copy-image'
  | 'download-image';
export const SHARE_ACTION_LABEL_KEYS = {
  native: 'share.native',
  x: 'share.x',
  reddit: 'share.reddit',
  telegram: 'share.telegram',
  'copy-text': 'share.copyText',
  'copy-link': 'share.copyLink',
  'copy-image': 'share.copyImage',
  'download-image': 'share.downloadImage',
} as const satisfies Readonly<Record<ShareActionName, string>>;
export type ShareActionLabelKey = (typeof SHARE_ACTION_LABEL_KEYS)[ShareActionName];
export type ShareActionPlacement = 'primary' | 'more' | 'secondary';
export type ShareActionDescriptor = Readonly<{
  action: ShareActionName;
  labelKey: ShareActionLabelKey;
  placement: ShareActionPlacement;
}>;
/** Callers own the content and poster; this feature owns channel formatting and interaction. */
export type ShareContent = Readonly<{
  title: string;
  slogan: string;
  result: string;
  fullText: string;
  /** Public URL only. Callers must not provide private result links or credentials. */
  landingUrl?: string;
  imageUrl?: string;
  posterFile?: File;
}>;
export type ShareCapabilities = Readonly<{
  surface: ShareSurface;
  canWebShare: boolean;
  canWebShareFiles: boolean;
  canCopyText: boolean;
  canCopyImage: boolean;
  canDownload: boolean;
  canOpenPlatform: boolean;
}>;
export type ShareFeedback = Readonly<{ kind: 'success' | 'error'; action: ShareActionName }>;
