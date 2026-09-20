import { useCallback, useMemo, useRef, useState } from 'react';
import { detectShareCapabilities, getShareActionDescriptors } from '../adapter/share.capabilities';
import {
  buildPlatformShareUrl,
  copyShareImage,
  copyShareText,
  downloadShareImage,
  nativeShareContent,
  openPlatformShareUrl,
} from '../adapter/share.dispatch';
import { buildNativeShareText, buildPlatformShareText, buildShareTextBundle } from './share-copy';
import { normalizeShareError, ShareError } from './share.errors';
import { buildShareLandingUrl } from './share-url';
import type {
  ShareActionName,
  ShareContent,
  ShareFeedback,
  SharePlatform,
  ShareSurface,
} from './share.types';
export type UseShareActionsOptions = Readonly<{ surface?: ShareSurface }>;
type ShareStatus = Readonly<{ scope: string; feedback?: ShareFeedback; error?: ShareError }>;
export function useShareActions(content: ShareContent, options: UseShareActionsOptions = {}) {
  const pendingRef = useRef<ShareActionName>();
  const [pendingAction, setPendingAction] = useState<ShareActionName>();
  const landingUrl = useMemo(
    () => buildShareLandingUrl({ baseUrl: content.landingUrl }),
    [content.landingUrl],
  );
  const contentKey = useMemo(
    () =>
      [
        content.title,
        content.slogan,
        content.result,
        content.fullText,
        landingUrl,
        content.imageUrl,
        content.posterFile?.name,
        content.posterFile?.size,
        content.posterFile?.lastModified,
      ].join('\u001f'),
    [
      content.fullText,
      content.imageUrl,
      content.posterFile,
      content.result,
      content.slogan,
      content.title,
      landingUrl,
    ],
  );
  const [status, setStatus] = useState<ShareStatus>({ scope: contentKey });
  const feedback = status.scope === contentKey ? status.feedback : undefined;
  const error = status.scope === contentKey ? status.error : undefined;
  const normalizedContent = useMemo(() => ({ ...content, landingUrl }), [content, landingUrl]);
  const capabilities = useMemo(
    () => detectShareCapabilities({ surface: options.surface, posterFile: content.posterFile }),
    [content.posterFile, options.surface],
  );
  const actions = useMemo(
    () => getShareActionDescriptors(normalizedContent, capabilities),
    [capabilities, normalizedContent],
  );
  const runAction = useCallback(
    async (action: ShareActionName, execute: () => Promise<void> | void) => {
      if (pendingRef.current) return;
      pendingRef.current = action;
      setPendingAction(action);
      setStatus({ scope: contentKey });
      try {
        await execute();
        setStatus({ scope: contentKey, feedback: { kind: 'success', action } });
      } catch (actionError) {
        const normalized = normalizeShareError(actionError);
        if (normalized.code !== 'cancelled')
          setStatus({ scope: contentKey, error: normalized, feedback: { kind: 'error', action } });
      } finally {
        pendingRef.current = undefined;
        setPendingAction(undefined);
      }
    },
    [contentKey],
  );
  const clearFeedback = useCallback(() => setStatus({ scope: contentKey }), [contentKey]);
  const copyText = useCallback(
    () =>
      runAction('copy-text', () =>
        copyShareText(buildShareTextBundle(content.fullText, landingUrl, content.imageUrl)),
      ),
    [content.fullText, content.imageUrl, landingUrl, runAction],
  );
  const copyLink = useCallback(
    () =>
      runAction('copy-link', () => {
        if (!landingUrl) throw new ShareError('unsupported', 'A public landing URL is required.');
        return copyShareText(landingUrl);
      }),
    [landingUrl, runAction],
  );
  const copyImage = useCallback(
    () =>
      runAction('copy-image', () => {
        if (!content.posterFile) throw new ShareError('unsupported', 'A poster file is required.');
        return copyShareImage(content.posterFile);
      }),
    [content.posterFile, runAction],
  );
  const downloadImage = useCallback(
    () =>
      runAction('download-image', () => {
        if (!content.posterFile) throw new ShareError('unsupported', 'A poster file is required.');
        downloadShareImage(content.posterFile);
      }),
    [content.posterFile, runAction],
  );
  const nativeShare = useCallback(
    () =>
      runAction('native', () =>
        nativeShareContent(
          content.title,
          buildNativeShareText(content.slogan, content.result),
          landingUrl,
          content.posterFile,
        ),
      ),
    [content.posterFile, content.result, content.slogan, content.title, landingUrl, runAction],
  );
  const sharePlatform = useCallback(
    (platform: SharePlatform) =>
      runAction(platform, () => {
        if (!landingUrl) throw new ShareError('unsupported', 'A public landing URL is required.');
        openPlatformShareUrl(
          buildPlatformShareUrl(
            platform,
            buildPlatformShareText(content.slogan, content.result, platform),
            landingUrl,
          ),
        );
      }),
    [content.result, content.slogan, landingUrl, runAction],
  );
  return {
    capabilities,
    actions,
    pendingAction,
    feedback,
    error,
    clearFeedback,
    copyText,
    copyLink,
    copyImage,
    downloadImage,
    nativeShare,
    sharePlatform,
  } as const;
}
