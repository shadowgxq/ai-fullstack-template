import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import Taro from './taro-mock';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { parseProfile, type Profile } from '../src/shared/api/gateway';
import { parseMedia, uploadPrivatePhoto } from '../src/shared/api/media';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';
import { AvatarUpload, ProfileEditor } from '../src/features/profile/editor';
import {
  draftFromProfile,
  profileInput,
  validateProfileDraft,
} from '../src/features/profile/draft';
import { profileQueryOptions } from '../src/features/profile/queries';
import { logoutProfileSession } from '../src/features/profile/logout';

const avatarId = '11111111-1111-4111-8111-111111111111';
const profile: Profile = {
  user_id: 1,
  version: 1,
  nickname: null,
  avatar_media_id: null,
  city_id: 'city-read-only',
};
const ready = {
  id: avatarId,
  purpose: 'avatar' as const,
  status: 'ready' as const,
  content_type: 'image/png',
  size_bytes: 100,
  width: 64,
  height: 64,
};
type Call = {
  url: string;
  method: string;
  data: unknown;
  header: Record<string, string>;
  success: (response: { statusCode: number; data: unknown }) => void;
  fail: () => void;
};
type Upload = {
  url: string;
  filePath: string;
  header: Record<string, string>;
  formData: Record<string, string>;
  success: (response: { statusCode: number; data: string }) => void;
  fail: () => void;
};
let calls: Call[], uploads: Upload[];
let abort: ReturnType<typeof vi.fn>;
function success(call: Call, data: unknown) {
  call.success({ statusCode: 200, data: { code: 0, message: 'ok', data } });
}
function uploadSuccess(call: Upload, data: unknown) {
  call.success({ statusCode: 200, data: JSON.stringify({ code: 0, message: 'ok', data }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('profile-token', 1);
  calls = [];
  uploads = [];
  abort = vi.fn();
  const task = () => Object.assign(new Promise(() => {}), { abort });
  Taro.request.mockImplementation((call: Call) => {
    calls.push(call);
    return task();
  });
  Taro.uploadFile.mockImplementation((call: Upload) => {
    uploads.push(call);
    return task();
  });
});

describe('profile provider and draft', () => {
  it('requires the actual version, preserves optional values and sends only editable fields', () => {
    expect(parseProfile(profile)).toEqual(profile);
    for (const version of [undefined, 0, '1', 1.5])
      expect(() => parseProfile({ ...profile, version })).toThrow();
    const draft = draftFromProfile(profile);
    expect(draft.nickname).toBe('');
    expect(profileInput({ ...draft, nickname: '  新昵称  ' }, 1)).toEqual({
      expected_version: 1,
      nickname: '新昵称',
      avatar_media_id: null,
    });
    expect(profileInput(draft, 1)).not.toHaveProperty('city_id');
    expect(validateProfileDraft({ ...draft, nickname: 'a'.repeat(81) })).toContain('80');
    expect(
      validateProfileDraft({ ...draft, nickname: ' '.repeat(100) + 'a'.repeat(80) }),
    ).toBeNull();
  });
  it('matches the requested ready media purpose and rejects cross-purpose or incomplete responses', () => {
    expect(parseMedia(ready, 'avatar')).toEqual(ready);
    expect(() => parseMedia(ready, 'garment')).toThrow();
    expect(() => parseMedia({ ...ready, purpose: 'garment' }, 'avatar')).toThrow();
    expect(() => parseMedia({ ...ready, status: 'pending' }, 'avatar')).toThrow();
  });
});

describe('profile save and close recovery', () => {
  it('keeps the initial version, verifies unknown results and never resubmits completed data', async () => {
    const editor = new ProfileEditor(getAuthSession()!, profile);
    const draft = { ...draftFromProfile(profile), nickname: '新昵称' };
    const first = editor.save(draft);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].data).toEqual({
      expected_version: 1,
      nickname: '新昵称',
      avatar_media_id: null,
    });
    calls[0].fail();
    await expect(first).rejects.toThrow();
    expect(editor.uncertain).toBe(true);
    await expect(editor.save({ ...draft, nickname: '另一个名字' })).rejects.toThrow('原操作');
    expect(calls).toHaveLength(1);
    const retry = editor.save(draft);
    expect(calls[1].method).toBe('GET');
    success(calls[1], { ...profile, version: 2, nickname: '新昵称' });
    await expect(retry).resolves.toMatchObject({ version: 2 });
    expect(editor.saved).toBe(true);
    await editor.save(draft);
    expect(calls).toHaveLength(2);
  });
  it('does not treat unchanged same-version fields as proof of a lost no-op PATCH and preserves conflict draft', async () => {
    const editor = new ProfileEditor(getAuthSession()!, profile);
    const draft = draftFromProfile(profile);
    const first = editor.save(draft);
    calls[0].fail();
    await expect(first).rejects.toThrow();
    const retry = editor.save(draft);
    success(calls[1], profile);
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].data).toMatchObject({ expected_version: 1 });
    calls[2].success({ statusCode: 409, data: {} });
    await expect(retry).rejects.toMatchObject({ status: 409 });
    expect(draft).toEqual(draftFromProfile(profile));
    expect(editor.saved).toBe(false);
    expect(editor.uncertain).toBe(false);
  });
  it.each(['switch', 'abort', 'close'] as const)(
    'discards a resolved recovery GET before its await continuation after %s',
    async (change) => {
      const controller = new AbortController();
      const editor = new ProfileEditor(getAuthSession()!, profile);
      const draft = { ...draftFromProfile(profile), nickname: '新昵称' };
      const first = editor.save(draft, controller.signal);
      calls[0].fail();
      await expect(first).rejects.toThrow();
      const retry = editor.save(draft, controller.signal);
      success(calls[1], { ...profile, version: 2, nickname: '新昵称' });
      if (change === 'switch') saveAuthSession('new-owner', 2);
      else if (change === 'abort') controller.abort();
      else editor.close();
      await expect(retry).rejects.toMatchObject({ name: 'AbortError' });
      expect(editor.saved).toBe(false);
    },
  );
  it('discards a successful PATCH after close and does not expose a mismatched owner', async () => {
    const editor = new ProfileEditor(getAuthSession()!, profile);
    const saving = editor.save(draftFromProfile(profile));
    success(calls[0], { ...profile, version: 2 });
    editor.close();
    await expect(saving).rejects.toMatchObject({ name: 'AbortError' });
    expect(editor.saved).toBe(false);
    const other = new ProfileEditor(getAuthSession()!, profile);
    const denied = other.save(draftFromProfile(profile));
    success(calls[1], { ...profile, user_id: 2, version: 2 });
    await expect(denied).rejects.toMatchObject({ kind: 'invalid-response' });
    expect(other.saved).toBe(false);
  });
});

describe('one media pipeline and profile consumers', () => {
  it('retries the same avatar selection with the same upload key and explicit purpose', async () => {
    const upload = new AvatarUpload();
    upload.select('wxfile://chosen-avatar');
    const first = upload.upload(getAuthSession()!);
    expect(uploads[0].formData).toEqual({ purpose: 'avatar' });
    expect(uploads[0].header.Authorization).toBe('Bearer profile-token');
    uploads[0].fail();
    await expect(first).rejects.toMatchObject({ kind: 'network' });
    const retry = upload.upload(getAuthSession()!);
    expect(uploads[1].filePath).toBe(uploads[0].filePath);
    expect(uploads[1].header['Idempotency-Key']).toBe(uploads[0].header['Idempotency-Key']);
    uploadSuccess(uploads[1], ready);
    await expect(retry).resolves.toEqual(ready);
    const wrong = uploadPrivatePhoto('wxfile://same', 'same', 'avatar');
    uploadSuccess(uploads[2], { ...ready, purpose: 'garment' });
    await expect(wrong).rejects.toMatchObject({ kind: 'invalid-response' });
  });
  it('cancels an avatar upload on close and discards a response resolved just before cancellation', async () => {
    const controller = new AbortController();
    const upload = new AvatarUpload();
    upload.select('wxfile://avatar');
    const first = upload.upload(getAuthSession()!, controller.signal);
    controller.abort();
    uploadSuccess(uploads[0], ready);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(abort).toHaveBeenCalled();
    const next = new AvatarUpload();
    next.select('wxfile://avatar-2');
    const late = next.upload(getAuthSession()!);
    uploadSuccess(uploads[1], ready);
    next.clear();
    await expect(late).rejects.toMatchObject({ name: 'AbortError' });
    expect(next.path).toBeNull();
  });
  it('uses the single profile query and removes old account data when switching', async () => {
    const session = getAuthSession()!;
    const observer = new QueryObserver(queryClient, profileQueryOptions(session));
    const unsubscribe = observer.subscribe(() => undefined);
    success(calls[0], profile);
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.version).toBe(1));
    const editor = new ProfileEditor(session, profile);
    const save = editor.save({ ...draftFromProfile(profile), nickname: '新昵称' });
    success(calls[1], { ...profile, version: 2, nickname: '新昵称' });
    const saved = await save;
    queryClient.setQueryData(sessionQueryKey(session, 'profile'), saved);
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.nickname).toBe('新昵称'));
    saveAuthSession('other', 2);
    observer.setOptions(profileQueryOptions(getAuthSession()));
    success(calls[2], { ...profile, user_id: 2, version: 1 });
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.user_id).toBe(2));
    expect(observer.getCurrentResult().data?.nickname).toBeNull();
    expect(queryClient.getQueryData(sessionQueryKey(session, 'profile'))).toBeUndefined();
    unsubscribe();
  });
  it('keeps remote logout failure explicit and never applies old logout feedback to a new login', async () => {
    const old = getAuthSession()!;
    const logout = logoutProfileSession(old);
    calls[0].fail();
    const result = await logout;
    expect(getAuthSession()).toBeNull();
    expect(result?.warning).toContain('尚未确认');
    saveAuthSession('fresh', 1);
    const session = getAuthSession()!;
    const pending = logoutProfileSession(session);
    saveAuthSession('new-owner', 2);
    success(calls[1], null);
    await expect(pending).resolves.toBeNull();
    expect(getAuthSession()?.userId).toBe(2);
  });
});
