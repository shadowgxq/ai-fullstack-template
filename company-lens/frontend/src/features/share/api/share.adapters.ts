import { isApiError, request, type RequestConfig } from '../../../shared/api';
import { ShareError } from '../model/share.errors';
import type { ShareImageUploadInput, ShareUploadedAsset } from '../model/share.types';

type RequestFunction = <TResponse = unknown, TData = unknown>(
  config: RequestConfig<TData>,
) => Promise<TResponse>;

export type ShareImageUploadAdapter = {
  upload: (input: ShareImageUploadInput) => Promise<ShareUploadedAsset>;
};

export type ApiShareImageUploadAdapterOptions = {
  request?: RequestFunction;
};

export const SHARE_API_PATHS = {
  uploadImage: '/v1/files/upload',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getEnvelopeErrorMessage(value: Record<string, unknown>, code: number): string {
  return optionalString(value.message) ?? optionalString(value.msg) ?? `API returned code ${code}.`;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ShareError('contract-invalid', `${field} must be a non-empty string.`);
  }
  return value;
}

function normalizeShareError(error: unknown): ShareError {
  if (error instanceof ShareError) {
    return error;
  }
  if (isApiError(error)) {
    if (error.status === 401) {
      return new ShareError('unauthorized', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    return new ShareError('request-failed', error.message, {
      status: error.status,
      apiCode: error.code,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
  }
  return new ShareError(
    'request-failed',
    error instanceof Error ? error.message : 'Share request failed.',
  );
}

function parseUploadedAssetEnvelope(
  value: unknown,
  input: ShareImageUploadInput,
): ShareUploadedAsset {
  if (!isRecord(value) || typeof value.code !== 'number' || !('data' in value)) {
    throw new ShareError('contract-invalid', 'Upload response did not return a valid payload.');
  }
  if (value.code !== 200) {
    throw new ShareError('request-failed', getEnvelopeErrorMessage(value, value.code), {
      apiCode: value.code,
      ...(optionalString(value.errorCode) ? { errorCode: optionalString(value.errorCode) } : {}),
    });
  }
  if (!isRecord(value.data)) {
    throw new ShareError('contract-invalid', 'Upload response did not return a valid payload.');
  }
  return {
    assetId: requiredString(value.data.fileId, 'fileId'),
    publicUrl: requiredString(value.data.fileUrl, 'fileUrl'),
    fileName: input.fileName,
    blob: input.blob,
    isDevelopmentMarker: false,
  };
}

export function createApiShareImageUploadAdapter(
  options: ApiShareImageUploadAdapterOptions = {},
): ShareImageUploadAdapter {
  const requestFn = options.request ?? request;
  return {
    async upload(input) {
      if (input.blob.size === 0) {
        throw new ShareError('upload-failed', 'The poster image is empty.');
      }
      const formData = new FormData();
      formData.append('biz', 'shares');
      formData.append(
        'file',
        new File([input.blob], input.fileName, { type: input.blob.type || 'image/png' }),
      );
      try {
        const payload = await requestFn<unknown, FormData>({
          method: 'POST',
          url: SHARE_API_PATHS.uploadImage,
          data: formData,
        });
        return parseUploadedAssetEnvelope(payload, input);
      } catch (error) {
        const normalized = normalizeShareError(error);
        throw new ShareError('upload-failed', 'The poster image could not be uploaded.', {
          status: normalized.status,
          apiCode: normalized.apiCode,
          errorCode: normalized.errorCode,
          serverMessage: normalized.message,
        });
      }
    },
  };
}

let mockUploadSequence = 0;

/** Mock marker 只用于离线开发诊断，不能当作公开图片 URL。 */
export const mockShareImageUploadAdapter: ShareImageUploadAdapter = {
  async upload(input) {
    if (input.blob.size === 0) {
      throw new ShareError('upload-failed', 'The poster image is empty.');
    }
    mockUploadSequence += 1;
    return {
      assetId: `mock://share-images/${mockUploadSequence.toString().padStart(4, '0')}`,
      fileName: input.fileName,
      blob: input.blob,
      isDevelopmentMarker: true,
    };
  },
};
