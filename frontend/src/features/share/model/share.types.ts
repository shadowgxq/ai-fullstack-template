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

/** Business features provide facts; the share layer owns channel-specific formatting. */
export type ShareContent = Readonly<{
  title: string;
  slogan: string;
  result: string;
  fullText: string;
  /** Public result/tool URL. Never include login tokens or private query parameters. */
  landingUrl?: string;
  /** Optional public image URL used only by the copy-text bundle. */
  imageUrl?: string;
  /** Actual local image file used by system share, clipboard image, and download. */
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

export type ShareFeedback = Readonly<{
  kind: 'success' | 'error';
  action: ShareActionName;
}>;
