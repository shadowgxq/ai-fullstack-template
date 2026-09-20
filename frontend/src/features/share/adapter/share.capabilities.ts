import {
  SHARE_ACTION_LABEL_KEYS,
  SHARE_PLATFORMS,
  type ShareActionName,
  type ShareActionDescriptor,
  type ShareActionPlacement,
  type ShareCapabilities,
  type ShareContent,
  type ShareSurface,
} from '../model/share.types';
export type DetectShareCapabilitiesOptions = Readonly<{
  surface?: ShareSurface;
  posterFile?: File;
}>;
function detectSurface(): ShareSurface {
  if (typeof window === 'undefined') return 'desktop';
  const narrow = window.matchMedia?.('(max-width: 720px)').matches ?? false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return narrow || coarse ? 'h5' : 'desktop';
}
function describeAction(
  action: ShareActionName,
  placement: ShareActionPlacement,
): ShareActionDescriptor {
  return { action, labelKey: SHARE_ACTION_LABEL_KEYS[action], placement };
}
/** Screen size sets priority only. Actual capabilities are always API-detected. */
export function detectShareCapabilities(
  options: DetectShareCapabilitiesOptions = {},
): ShareCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      surface: options.surface ?? 'desktop',
      canWebShare: false,
      canWebShareFiles: false,
      canCopyText: false,
      canCopyImage: false,
      canDownload: false,
      canOpenPlatform: false,
    };
  }
  const secure = window.isSecureContext === true;
  const canWebShare = secure && typeof navigator.share === 'function';
  let canWebShareFiles = false;
  if (canWebShare && options.posterFile && typeof navigator.canShare === 'function') {
    try {
      canWebShareFiles = navigator.canShare({ files: [options.posterFile] });
    } catch {
      canWebShareFiles = false;
    }
  }
  return {
    surface: options.surface ?? detectSurface(),
    canWebShare,
    canWebShareFiles,
    canCopyText: secure && typeof navigator.clipboard?.writeText === 'function',
    canCopyImage:
      secure &&
      Boolean(options.posterFile) &&
      typeof ClipboardItem === 'function' &&
      typeof navigator.clipboard?.write === 'function',
    canDownload:
      Boolean(options.posterFile) &&
      typeof document !== 'undefined' &&
      typeof URL.createObjectURL === 'function',
    canOpenPlatform: typeof window.open === 'function',
  };
}
export function getShareActionDescriptors(
  content: ShareContent,
  capabilities: ShareCapabilities,
): readonly ShareActionDescriptor[] {
  const actions: ShareActionDescriptor[] = [];
  const hasLandingUrl = Boolean(content.landingUrl);
  const platformPlacement =
    capabilities.surface === 'h5' && capabilities.canWebShare ? 'more' : 'primary';
  if (capabilities.canWebShare)
    actions.push(describeAction('native', capabilities.surface === 'h5' ? 'primary' : 'more'));
  if (hasLandingUrl && capabilities.canOpenPlatform)
    SHARE_PLATFORMS.forEach((action) => actions.push(describeAction(action, platformPlacement)));
  if (capabilities.canCopyText) {
    actions.push(describeAction('copy-text', 'secondary'));
    if (hasLandingUrl) actions.push(describeAction('copy-link', 'secondary'));
  }
  if (capabilities.canCopyImage) actions.push(describeAction('copy-image', 'secondary'));
  if (capabilities.canDownload) actions.push(describeAction('download-image', 'secondary'));
  return actions;
}
