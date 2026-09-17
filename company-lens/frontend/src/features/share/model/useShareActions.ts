import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { getShareComposition } from '../api/share.composition';
import { detectShareCapabilities } from '../adapter/share.capabilities';
import {
  buildPlatformShareUrl,
  copyShareText,
  downloadShareImage,
  nativeShareSharePayload,
  openPendingPlatformWindow,
  openPlatformShareUrl,
} from '../adapter/share.dispatch';
import { buildNativeShareText, buildPlatformShareText, buildShareTextBundle } from './share-copy';
import { ShareError, isShareError } from './share.errors';
import { getCurrentPageShareUrl } from './share-url';
import type {
  ShareActionName,
  ShareCapabilities,
  SharePayload,
  SharePlatform,
  ShareResourceStatus,
  ShareUploadedAsset,
} from './share.types';

export type ShareResourceState<TValue> = {
  status: ShareResourceStatus;
  value?: TValue;
  error?: ShareError;
};

export type ShareFeedback = {
  kind: 'success' | 'error';
  action: ShareActionName;
};

type ShareState = {
  scopeKey: string;
  captureState: ShareResourceState<Blob>;
  uploadState: ShareResourceState<ShareUploadedAsset>;
  previewUrl?: string;
  pendingAction?: ShareActionName;
  feedback?: ShareFeedback;
  error?: ShareError;
};

type ShareStateAction = {
  type: 'patch';
  scopeKey: string;
  patch: Partial<Omit<ShareState, 'scopeKey'>>;
};

function createInitialShareState(scopeKey: string): ShareState {
  return {
    scopeKey,
    captureState: { status: 'idle' },
    uploadState: { status: 'idle' },
  };
}

function shareStateReducer(state: ShareState, action: ShareStateAction): ShareState {
  const baseState =
    state.scopeKey === action.scopeKey ? state : createInitialShareState(action.scopeKey);
  return { ...baseState, ...action.patch, scopeKey: action.scopeKey };
}

export type UseShareActionsOptions = {
  open?: boolean;
  timeoutMs?: number;
};

export type UseShareActionsResult = {
  capabilities: ShareCapabilities;
  captureState: ShareResourceState<Blob>;
  uploadState: ShareResourceState<ShareUploadedAsset>;
  previewUrl?: string;
  pendingAction?: ShareActionName;
  feedback?: ShareFeedback;
  error?: ShareError;
  capturePoster: (element: HTMLElement | null) => Promise<void>;
  preparePoster: (element: HTMLElement | null) => Promise<void>;
  uploadImage: () => Promise<void>;
  copyText: () => Promise<void>;
  copyLink: () => Promise<void>;
  downloadImage: () => Promise<void>;
  nativeShare: () => Promise<void>;
  sharePlatform: (platform: SharePlatform) => Promise<void>;
};

function toShareError(error: unknown, fallbackCode: ShareError['code']): ShareError {
  if (isShareError(error)) {
    return error;
  }
  return new ShareError(
    fallbackCode,
    error instanceof Error ? error.message : 'Share action failed.',
  );
}

function withTimeout<TValue>(promise: Promise<TValue>, timeoutMs: number): Promise<TValue> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new ShareError('timeout', 'Share action timed out.'));
    }, timeoutMs);
    void promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function getPublicAssetUrl(asset: ShareUploadedAsset | undefined): string | undefined {
  return asset?.publicUrl && !asset.isDevelopmentMarker ? asset.publicUrl : undefined;
}

export function useShareActions(
  payload: SharePayload | undefined,
  options: UseShareActionsOptions = {},
): UseShareActionsResult {
  const open = options.open ?? true;
  const timeoutMs = options.timeoutMs ?? 8000;
  const [capabilities] = useState<ShareCapabilities>(detectShareCapabilities);
  const generationRef = useRef(0);
  const previewUrlRef = useRef<string>();
  const blobRef = useRef<Blob>();
  const uploadedAssetRef = useRef<ShareUploadedAsset>();

  const payloadKey = payload
    ? `${payload.subjectKind}:${payload.targetId}:${payload.slogan}:${payload.result}:${payload.fullText}:${payload.dataDate ?? ''}`
    : '';
  const scopeKey = `${open ? 'open' : 'closed'}:${payloadKey}`;
  const [state, dispatch] = useReducer(shareStateReducer, scopeKey, createInitialShareState);
  const scopedState = state.scopeKey === scopeKey ? state : createInitialShareState(scopeKey);
  const { captureState, uploadState, previewUrl, pendingAction, feedback, error } = scopedState;

  useEffect(() => {
    generationRef.current += 1;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = undefined;
    }
    blobRef.current = undefined;
    uploadedAssetRef.current = undefined;
  }, [open, payloadKey]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const runAction = useCallback(
    async (
      action: ShareActionName,
      execute: (generation: number) => Promise<void>,
      showSuccess = true,
    ): Promise<boolean> => {
      if (!payload || pendingAction) {
        return false;
      }
      const generation = generationRef.current;
      dispatch({
        type: 'patch',
        scopeKey,
        patch: { pendingAction: action, feedback: undefined, error: undefined },
      });
      try {
        await execute(generation);
        if (generationRef.current !== generation) {
          return false;
        }
        if (showSuccess) {
          dispatch({ type: 'patch', scopeKey, patch: { feedback: { kind: 'success', action } } });
        }
        return true;
      } catch (actionError) {
        if (generationRef.current === generation) {
          const normalized = toShareError(actionError, 'request-failed');
          dispatch({
            type: 'patch',
            scopeKey,
            patch: { error: normalized, feedback: { kind: 'error', action } },
          });
        }
        return false;
      } finally {
        if (generationRef.current === generation) {
          dispatch({ type: 'patch', scopeKey, patch: { pendingAction: undefined } });
        }
      }
    },
    [payload, pendingAction, scopeKey],
  );

  const capturePosterAction = useCallback(
    (element: HTMLElement | null, showSuccess = true): Promise<boolean> =>
      runAction(
        'capture',
        async (generation) => {
          if (!element) {
            throw new ShareError('capture-failed', 'Poster target is unavailable.');
          }
          dispatch({ type: 'patch', scopeKey, patch: { captureState: { status: 'pending' } } });
          try {
            const { capturePoster: capture } = await import('../adapter/share-poster.capture');
            const blob = await withTimeout(
              capture(element, { pixelRatio: 2, timeoutMs }),
              timeoutMs,
            );
            if (generationRef.current !== generation) {
              return;
            }
            if (previewUrlRef.current) {
              URL.revokeObjectURL(previewUrlRef.current);
            }
            const nextPreviewUrl = URL.createObjectURL(blob);
            previewUrlRef.current = nextPreviewUrl;
            blobRef.current = blob;
            dispatch({
              type: 'patch',
              scopeKey,
              patch: {
                previewUrl: nextPreviewUrl,
                captureState: { status: 'ready', value: blob },
                uploadState: { status: 'idle' },
              },
            });
          } catch (captureError) {
            const normalized = toShareError(captureError, 'capture-failed');
            if (generationRef.current === generation) {
              dispatch({
                type: 'patch',
                scopeKey,
                patch: { captureState: { status: 'error', error: normalized } },
              });
            }
            throw captureError;
          }
        },
        showSuccess,
      ),
    [runAction, scopeKey, timeoutMs],
  );

  const capturePoster = useCallback(
    async (element: HTMLElement | null): Promise<void> => {
      await capturePosterAction(element);
    },
    [capturePosterAction],
  );

  const uploadPoster = useCallback(
    async (generation: number): Promise<ShareUploadedAsset> => {
      if (uploadedAssetRef.current) {
        return uploadedAssetRef.current;
      }
      const blob = blobRef.current;
      if (!payload || !blob) {
        throw new ShareError('upload-failed', 'Create the poster before uploading it.');
      }
      dispatch({ type: 'patch', scopeKey, patch: { uploadState: { status: 'pending' } } });
      try {
        const asset = await withTimeout(
          getShareComposition().imageUploadAdapter.upload({
            blob,
            fileName: payload.fileName,
            subjectKind: payload.subjectKind,
            targetId: payload.targetId,
          }),
          timeoutMs,
        );
        if (generationRef.current === generation) {
          uploadedAssetRef.current = asset;
          dispatch({
            type: 'patch',
            scopeKey,
            patch: { uploadState: { status: 'ready', value: asset } },
          });
        }
        return asset;
      } catch (uploadError) {
        if (generationRef.current === generation) {
          const normalized = toShareError(uploadError, 'upload-failed');
          dispatch({
            type: 'patch',
            scopeKey,
            patch: { uploadState: { status: 'error', error: normalized } },
          });
        }
        throw uploadError;
      }
    },
    [payload, scopeKey, timeoutMs],
  );

  const uploadImage = useCallback(async () => {
    await runAction('upload', async (generation) => {
      await uploadPoster(generation);
    });
  }, [runAction, uploadPoster]);

  const preparePoster = useCallback(
    async (element: HTMLElement | null): Promise<void> => {
      await capturePosterAction(element, false);
    },
    [capturePosterAction],
  );

  const copyText = useCallback(async () => {
    await runAction('copy-text', async () => {
      if (!payload) {
        return;
      }
      const landingUrl =
        payload.landingCapability === 'project' ? getCurrentPageShareUrl() : undefined;
      await copyShareText(
        buildShareTextBundle(payload.fullText, landingUrl, getPublicAssetUrl(uploadState.value)),
      );
    });
  }, [payload, runAction, uploadState.value]);

  const copyLink = useCallback(async () => {
    await runAction('copy-link', async () => {
      if (!payload || payload.landingCapability !== 'project') {
        throw new ShareError('unsupported', 'A project landing link is unavailable.');
      }
      await copyShareText(getCurrentPageShareUrl());
    });
  }, [payload, runAction]);

  const downloadImage = useCallback(async () => {
    await runAction('download', async () => {
      const blob = blobRef.current;
      if (!blob || !payload) {
        throw new ShareError('unsupported', 'Create the poster before downloading it.');
      }
      downloadShareImage(blob, payload.fileName);
    });
  }, [payload, runAction]);

  const nativeShare = useCallback(async () => {
    await runAction('native', async () => {
      if (!payload) {
        return;
      }
      await nativeShareSharePayload(
        buildNativeShareText(payload.slogan, payload.result),
        payload.title,
        payload.landingCapability === 'project' ? getCurrentPageShareUrl() : undefined,
        blobRef.current,
        payload.fileName,
      );
    });
  }, [payload, runAction]);

  const sharePlatform = useCallback(
    async (platform: SharePlatform) => {
      const pendingWindow = openPendingPlatformWindow();
      const succeeded = await runAction(platform, async () => {
        if (!payload || payload.landingCapability !== 'project') {
          throw new ShareError('unsupported', 'Platform links require a project landing link.');
        }
        openPlatformShareUrl(
          buildPlatformShareUrl(
            platform,
            buildPlatformShareText(payload.slogan, payload.result, platform),
            getCurrentPageShareUrl(),
          ),
          pendingWindow,
        );
      });
      if (!succeeded) {
        pendingWindow?.close();
      }
    },
    [payload, runAction],
  );

  return {
    capabilities,
    captureState,
    uploadState,
    previewUrl,
    pendingAction,
    feedback,
    error,
    capturePoster,
    preparePoster,
    uploadImage,
    copyText,
    copyLink,
    downloadImage,
    nativeShare,
    sharePlatform,
  };
}
