import { describe, expect, it } from 'vitest';

import type { RequestConfig } from '../../../shared/api';
import {
  createApiShareImageUploadAdapter,
  mockShareImageUploadAdapter,
  SHARE_API_PATHS,
} from './share.adapters';

describe('share adapters', () => {
  it('uploads the PNG through the public file contract', async () => {
    const requests: RequestConfig<FormData>[] = [];
    const adapter = createApiShareImageUploadAdapter({
      request: async <TResponse, TData>(config: RequestConfig<TData>) => {
        requests.push(config as RequestConfig<FormData>);
        return {
          code: 200,
          data: {
            fileId: 'asset.png',
            fileUrl: 'https://files.example.test/api/v1/files/shares/asset.png',
          },
        } as TResponse;
      },
    });
    const blob = new Blob(['png-bytes'], { type: 'image/png' });

    await expect(
      adapter.upload({
        blob,
        fileName: 'research.png',
        subjectKind: 'research-result',
        targetId: 'project-1',
      }),
    ).resolves.toMatchObject({
      assetId: 'asset.png',
      publicUrl: 'https://files.example.test/api/v1/files/shares/asset.png',
      fileName: 'research.png',
      isDevelopmentMarker: false,
    });
    expect(requests[0]).toMatchObject({ method: 'POST', url: SHARE_API_PATHS.uploadImage });
    expect(requests[0]?.data).toBeInstanceOf(FormData);
    expect(requests[0]?.data?.get('biz')).toBe('shares');
  });

  it('does not expose server file paths when image upload fails', async () => {
    const adapter = createApiShareImageUploadAdapter({
      request: async () => {
        throw {
          __apiError: true,
          message: 'java.io.FileNotFoundException: /tmp/tomcat/uploads/files/shares/poster.png',
          status: 500,
        };
      },
    });

    await expect(
      adapter.upload({
        blob: new Blob(['png-bytes'], { type: 'image/png' }),
        fileName: 'research.png',
        subjectKind: 'research-result',
        targetId: 'project-1',
      }),
    ).rejects.toMatchObject({
      code: 'upload-failed',
      message: 'The poster image could not be uploaded.',
      status: 500,
    });
  });

  it('returns a development marker while preserving the actual PNG blob', async () => {
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const uploaded = await mockShareImageUploadAdapter.upload({
      blob,
      fileName: 'research.png',
      subjectKind: 'research-result',
      targetId: 'project-1',
    });

    expect(uploaded).toMatchObject({
      fileName: 'research.png',
      blob,
      isDevelopmentMarker: true,
    });
    expect(uploaded.assetId).toMatch(/^mock:\/\/share-images\//);
  });
});
