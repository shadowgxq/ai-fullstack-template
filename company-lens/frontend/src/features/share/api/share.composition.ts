import {
  createApiShareImageUploadAdapter,
  mockShareImageUploadAdapter,
  type ShareImageUploadAdapter,
} from './share.adapters';
import { runtimeConfig } from '../../../shared/config';

export type ShareComposition = {
  imageUploadAdapter: ShareImageUploadAdapter;
};

let testComposition: ShareComposition | undefined;

export function createShareComposition(): ShareComposition {
  return {
    imageUploadAdapter:
      runtimeConfig.researchDataSource === 'api'
        ? createApiShareImageUploadAdapter()
        : mockShareImageUploadAdapter,
  };
}

export function getShareComposition(): ShareComposition {
  return testComposition ?? createShareComposition();
}

export function setShareCompositionForTest(composition: ShareComposition | undefined): void {
  testComposition = composition;
}
