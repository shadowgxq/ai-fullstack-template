export const SHARE_SUBJECT_KINDS = ['research-result', 'company'] as const;
export type ShareSubjectKind = (typeof SHARE_SUBJECT_KINDS)[number];

export const SHARE_PLATFORMS = ['x', 'reddit', 'telegram'] as const;
export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

export type ShareLandingCapability = 'project' | 'none';

export type SharePosterVariant = 'default' | 'research-brief';

export type SharePosterMetricTone = 'positive' | 'caution' | 'neutral';
export type SharePosterSignalTone = 'opportunity' | 'risk' | 'neutral';

export type SharePosterMetric = Readonly<{
  label: string;
  value: string;
  tone?: SharePosterMetricTone;
}>;

export type SharePosterSignal = Readonly<{
  label: string;
  value: string;
  tone?: SharePosterSignalTone;
}>;

export type SharePosterResearchBrief = Readonly<{
  decisionLabel: string;
  decision: string;
  confidenceLabel?: string;
  confidence?: string;
  summary?: string;
  summaryDetail?: string;
  metricsLabel: string;
  metrics: readonly SharePosterMetric[];
  signals: readonly SharePosterSignal[];
}>;

export type SharePosterData = {
  variant?: SharePosterVariant;
  eyebrow?: string;
  badge?: string;
  title: string;
  identity?: string;
  metadata?: readonly string[];
  highlights?: readonly SharePosterHighlight[];
  conclusionLabel?: string;
  conclusion?: string;
  candidatesLabel?: string;
  candidates?: readonly SharePosterCandidate[];
  sections?: readonly SharePosterSection[];
  riskLabel?: string;
  riskStatement?: string;
  dataDate?: string;
  productEntry: string;
  researchBrief?: SharePosterResearchBrief;
};

export type SharePosterHighlight = {
  label: string;
  title: string;
  description?: string;
};

export type SharePosterCandidate = {
  rank: number;
  title: string;
  ticker?: string;
  reason?: string;
};

export type SharePosterSection = {
  label: string;
  value: string;
};

export type SharePayload = {
  subjectKind: ShareSubjectKind;
  targetId: string;
  projectId?: string;
  title: string;
  /** 固定的产品价值表达，仅用于平台短分享文案。 */
  slogan: string;
  /** 当前分析的短结果，平台文案只使用这一段，不复用完整报告。 */
  result: string;
  /** 复制图文使用的完整分享文案，不包含落地页和图片 URL。 */
  fullText: string;
  fileName: string;
  dataDate?: string;
  riskStatement?: string;
  productEntry: string;
  landingCapability: ShareLandingCapability;
  poster: SharePosterData;
};

export type ShareImageUploadInput = {
  blob: Blob;
  fileName: string;
  subjectKind: ShareSubjectKind;
  targetId: string;
};

export type ShareUploadedAsset = {
  assetId: string;
  fileName: string;
  blob: Blob;
  publicUrl?: string;
  isDevelopmentMarker: boolean;
};

export type ShareResourceStatus = 'idle' | 'pending' | 'ready' | 'error';

export type ShareCapabilities = {
  isMobile: boolean;
  canCopy: boolean;
  canDownload: boolean;
  canWebShare: boolean;
  canWebShareFiles: boolean;
  platforms: Readonly<Record<SharePlatform, boolean>>;
};

export type ShareActionName =
  | 'capture'
  | 'upload'
  | 'copy-text'
  | 'copy-link'
  | 'download'
  | 'native'
  | SharePlatform;
