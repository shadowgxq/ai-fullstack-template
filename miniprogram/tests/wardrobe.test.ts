import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfiniteQueryObserver } from '@tanstack/react-query';
import Taro from './taro-mock';
import { ApiError } from '../src/shared/api/errors';
import {
  clearAuthToken,
  getAuthToken,
  getAuthSession,
  saveAuthSession,
} from '../src/shared/api/auth-token';
import { queryClient } from '../src/shared/query/client';
import { garmentListQueryOptions } from '../src/features/wardrobe/queries';
import {
  parseGarment,
  parseGarmentCreated,
  parseGarmentList,
  parseOptions,
  garmentInput,
  draftFromGarment,
  wardrobeApi,
  type Garment,
} from '../src/features/wardrobe/api';
import {
  addCustomTag,
  emptyGarmentDraft,
  PendingCreate,
  toggleSelection,
  validateGarmentDraft,
} from '../src/features/wardrobe/draft';
import { downloadPrivatePhoto, parseMedia } from '../src/shared/api/media';
import { chooseImage } from '../src/shared/platform/wechat';

const garmentId = '11111111-1111-4111-8111-111111111111';
const mediaId = '22222222-2222-4222-8222-222222222222';
const garment: Garment = {
  id: garmentId,
  version: 1,
  name: '衬衫',
  photo_media_id: null,
  category: null,
  color: null,
  season: [],
  occasion: [],
  tags: [],
  notes: null,
  status: 'wearable',
  created_at: '2026-10-22T00:00:00Z',
  updated_at: '2026-10-22T00:00:00Z',
};
type Response = { statusCode: number; data: unknown };
type JsonCall = {
  url: string;
  method: string;
  header: Record<string, string>;
  data: unknown;
  success: (response: Response) => void;
  fail: () => void;
};
type UploadCall = {
  url: string;
  filePath: string;
  name: string;
  header: Record<string, string>;
  formData: Record<string, string>;
  success: (response: { statusCode: number; data: string }) => void;
  fail: () => void;
};
type DownloadCall = {
  url: string;
  header: Record<string, string>;
  success: (response: { statusCode: number; tempFilePath: string }) => void;
  fail: () => void;
};
let jsonCall: JsonCall;
let uploadCall: UploadCall;
let downloadCall: DownloadCall;
let abort: ReturnType<typeof vi.fn>;
let unlink: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  abort = vi.fn();
  unlink = vi.fn();
  Taro.getFileSystemManager.mockReturnValue({ unlink });
  clearAuthToken();
  saveAuthSession('private-token', 1);
  const task = () => Object.assign(new Promise(() => {}), { abort });
  Taro.request.mockImplementation((options: JsonCall) => {
    jsonCall = options;
    return task();
  });
  Taro.uploadFile.mockImplementation((options: UploadCall) => {
    uploadCall = options;
    return task();
  });
  Taro.downloadFile.mockImplementation((options: DownloadCall) => {
    downloadCall = options;
    return task();
  });
});

describe('garment provider contracts and draft rules', () => {
  it('validates actual garment, pagination, receipt and media shapes', () => {
    expect(parseGarment(garment)).toEqual(garment);
    expect(parseGarmentList({ items: [garment], next_cursor: null }).items).toHaveLength(1);
    expect(parseGarmentCreated({ id: garmentId, version: 1 })).toEqual({
      id: garmentId,
      version: 1,
    });
    expect(() => parseGarment({ ...garment, status: {} })).toThrow();
    expect(() => parseGarment({ ...garment, photo_media_id: 'bad' })).toThrow();
    expect(() => parseGarmentList({ items: [], next_cursor: 9 })).toThrow();
    expect(() =>
      parseMedia({ id: mediaId, purpose: 'garment', status: 'pending' }, 'garment'),
    ).toThrow();
    expect(() => parseOptions({ version: '1', categories: [] })).toThrow();
  });
  it('requires a nonblank name or successfully uploaded photo and preserves unknown fields', () => {
    const draft = emptyGarmentDraft();
    draft.name = '  ';
    expect(validateGarmentDraft(draft)).toContain('照片或填写衣物名称');
    draft.photoMediaId = mediaId;
    expect(validateGarmentDraft(draft)).toBeNull();
    expect(garmentInput(draft)).toEqual({
      name: null,
      photo_media_id: mediaId,
      category: null,
      color: null,
      season: [],
      occasion: [],
      tags: [],
      notes: null,
    });
  });
  it('retains multi-selection and custom tags when additional attributes are collapsed', () => {
    const draft = emptyGarmentDraft();
    draft.seasons = toggleSelection(draft.seasons, 'spring');
    draft.occasions = toggleSelection(draft.occasions, 'work');
    draft.tags = addCustomTag(draft.tags, ' 棉质 ');
    draft.tags = addCustomTag(draft.tags, '棉质');
    const collapsed = { ...draft, expanded: false };
    expect(collapsed.seasons).toEqual(['spring']);
    expect(collapsed.occasions).toEqual(['work']);
    expect(collapsed.tags).toEqual(['棉质']);
    expect(toggleSelection(collapsed.seasons, 'spring')).toEqual([]);
    expect(() => addCustomTag([], ' ')).toThrow();
  });
  it('serializes explicit removal as null or empty arrays and starts edit from saved fields', () => {
    const draft = draftFromGarment({
      ...garment,
      photo_media_id: mediaId,
      category: 'tops',
      color: 'white',
      season: ['spring'],
    });
    draft.photoMediaId = null;
    draft.category = null;
    draft.color = null;
    draft.seasons = [];
    expect(garmentInput(draft)).toMatchObject({
      photo_media_id: null,
      category: null,
      color: null,
      season: [],
    });
  });
  it('reuses immutable same-operation identity after response loss and rejects a new payload first', () => {
    const pending = new PendingCreate<{ name: string; season: string[] }>();
    const payload = { name: '衬衫', season: ['spring'] };
    const original = pending.begin(payload);
    payload.season.push('summer');
    pending.failed(new ApiError('timeout', 'network'));
    expect(pending.begin({ name: '衬衫', season: ['spring'] }).key).toBe(original.key);
    expect(original.payload.season).toEqual(['spring']);
    expect(() => pending.begin(payload)).toThrow('上次保存结果尚未确认');
    pending.complete();
    expect(pending.begin(payload).key).not.toBe(original.key);
  });
  it('permits corrected input with new identity after a definite validation rejection', () => {
    const pending = new PendingCreate<{ name: string }>();
    const original = pending.begin({ name: '' });
    pending.failed(new ApiError('invalid', 'http', 422));
    expect(pending.begin({ name: '棉衬衫' }).key).not.toBe(original.key);
  });
});

describe('garment and media transport', () => {
  it('starts a fresh cursor on filter change and ignores the cancelled old filter response', async () => {
    const calls: JsonCall[] = [];
    Taro.request.mockImplementation((options: JsonCall) => {
      calls.push(options);
      return Object.assign(new Promise(() => {}), { abort });
    });
    const observer = new InfiniteQueryObserver(
      queryClient,
      garmentListQueryOptions(getAuthSession(), { status: 'wearable' }),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    observer.setOptions(garmentListQueryOptions(getAuthSession(), { status: 'archived' }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toContain('status=archived');
    expect(calls[1].url).not.toContain('cursor=');
    calls[1].success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: { items: [{ ...garment, status: 'archived' }], next_cursor: null },
      },
    });
    calls[0].success({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: { items: [garment], next_cursor: 'old-cursor' } },
    });
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.pages[0].items[0].status).toBe('archived'),
    );
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
    expect(abort).toHaveBeenCalled();
    unsubscribe();
  });
  it('sends PATCH versions, stable create keys and encoded filters to the real backend', async () => {
    const patch = wardrobeApi.patch(garmentId, { expected_version: 1, category: null });
    expect(jsonCall.method).toBe('PATCH');
    expect(jsonCall.data).toEqual({ expected_version: 1, category: null });
    jsonCall.success({ statusCode: 200, data: { code: 0, message: 'ok', data: garment } });
    await patch;
    const create = wardrobeApi.create({ name: '衬衫' }, 'stable-operation');
    expect(jsonCall.header['Idempotency-Key']).toBe('stable-operation');
    jsonCall.success({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: { id: garmentId, version: 1 } },
    });
    await expect(create).resolves.toEqual({ id: garmentId, version: 1 });
    const list = wardrobeApi.list({ tag: '棉质 & 白色', status: 'wearable' }, 'cursor/+');
    expect(jsonCall.url).toContain('tag=' + encodeURIComponent('棉质 & 白色'));
    expect(jsonCall.url).toContain('cursor=cursor%2F%2B');
    jsonCall.success({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: { items: [], next_cursor: null } },
    });
    await list;
  });
  it('keeps camera and album actions explicit and cancellation separate from permission failure', async () => {
    Taro.chooseMedia.mockRejectedValueOnce({ errMsg: 'chooseMedia:fail cancel' });
    await expect(chooseImage('camera')).resolves.toBeNull();
    expect(Taro.chooseMedia.mock.calls[0][0].sourceType).toEqual(['camera']);
    Taro.chooseMedia.mockResolvedValueOnce({ tempFiles: [{ tempFilePath: 'wxfile://chosen' }] });
    await expect(chooseImage('album')).resolves.toBe('wxfile://chosen');
    expect(Taro.chooseMedia.mock.calls[1][0].sourceType).toEqual(['album']);
  });
  it('uploads one authenticated garment file and validates ready rather than assuming HTTP success', async () => {
    const upload = wardrobeApi.upload('wxfile://chosen', 'stable-photo');
    expect(uploadCall.url).toBe('https://api.example.test/api/v1/media');
    expect(uploadCall.header).toMatchObject({
      Authorization: 'Bearer private-token',
      'Idempotency-Key': 'stable-photo',
    });
    expect(uploadCall.formData).toEqual({ purpose: 'garment' });
    expect(uploadCall.name).toBe('file');
    uploadCall.success({
      statusCode: 200,
      data: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          id: mediaId,
          purpose: 'garment',
          status: 'ready',
          content_type: 'image/png',
          size_bytes: 200,
          width: 20,
          height: 30,
        },
      }),
    });
    await expect(upload).resolves.toMatchObject({ id: mediaId, status: 'ready' });
    const malformed = wardrobeApi.upload('wxfile://chosen', 'stable-photo');
    uploadCall.success({ statusCode: 200, data: '<html>' });
    await expect(malformed).rejects.toMatchObject({ kind: 'invalid-response' });
  });
  it('aborts upload on switch and refuses a late successful result', async () => {
    const upload = wardrobeApi.upload('wxfile://chosen', 'same');
    saveAuthSession('new', 2);
    uploadCall.success({ statusCode: 200, data: '{}' });
    await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
    expect(abort).toHaveBeenCalledOnce();
  });
  it('downloads privately, drops cached paths on logout and deletes late download files', async () => {
    const download = downloadPrivatePhoto(mediaId);
    expect(downloadCall.header.Authorization).toBe('Bearer private-token');
    expect(downloadCall.url).toBe('https://api.example.test/api/v1/media/' + mediaId + '/content');
    downloadCall.success({ statusCode: 200, tempFilePath: 'wxfile://private-photo' });
    await expect(download).resolves.toBe('wxfile://private-photo');
    clearAuthToken();
    expect(unlink).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'wxfile://private-photo' }),
    );
    saveAuthSession('second', 2);
    const late = downloadPrivatePhoto(mediaId);
    saveAuthSession('third', 3);
    downloadCall.success({ statusCode: 200, tempFilePath: 'wxfile://late-photo' });
    await expect(late).rejects.toMatchObject({ name: 'AbortError' });
    expect(unlink).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'wxfile://late-photo' }),
    );
    expect(getAuthToken()).toBe('third');
  });
  it('does not expose denied media content and invalidates matching 401', async () => {
    const download = downloadPrivatePhoto(mediaId);
    downloadCall.success({ statusCode: 401, tempFilePath: 'wxfile://error-body' });
    await expect(download).rejects.toMatchObject({ kind: 'http', status: 401 });
    expect(getAuthToken()).toBeNull();
    expect(unlink).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'wxfile://error-body' }),
    );
  });
  it('cancels the underlying upload on page departure and consumes transport rejection', async () => {
    const controller = new AbortController();
    const upload = wardrobeApi.upload('wxfile://chosen', 'same', controller.signal);
    controller.abort();
    await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
    expect(abort).toHaveBeenCalledOnce();
    Taro.uploadFile.mockImplementationOnce((options: UploadCall) => {
      queueMicrotask(() => options.fail());
      return Object.assign(Promise.reject(new Error('network')), { abort });
    });
    await expect(wardrobeApi.upload('wxfile://chosen', 'same')).rejects.toMatchObject({
      kind: 'network',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
