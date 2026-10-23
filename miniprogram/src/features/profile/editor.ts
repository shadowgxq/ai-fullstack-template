import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { api, type Profile, type ProfilePatch } from '../../shared/api/gateway';
import { ApiError, abortError } from '../../shared/api/errors';
import { uploadPrivatePhoto } from '../../shared/api/media';
import { newOperationKey } from '../wardrobe/draft';
import { profileInput, validateProfileDraft, type ProfileDraft } from './draft';

export class ProfileEditor {
  private pending: ProfilePatch | null = null;
  private unknown = false;
  private completed: Profile | null = null;
  private closed = false;
  constructor(
    private readonly session: AuthSession,
    private readonly initial: Profile,
  ) {}
  close(): void {
    this.closed = true;
  }
  get saved(): boolean {
    return Boolean(this.completed);
  }
  get uncertain(): boolean {
    return this.unknown;
  }
  private assertActive(signal?: AbortSignal): void {
    if (this.closed || signal?.aborted || getAuthSession() !== this.session) throw abortError();
  }
  private assertOwner(profile: Profile): void {
    if (profile.user_id !== this.session.userId)
      throw new ApiError('个人资料账户不匹配', 'invalid-response');
  }
  async save(draft: ProfileDraft, signal?: AbortSignal): Promise<Profile> {
    this.assertActive(signal);
    this.assertOwner(this.initial);
    if (this.completed) return this.completed;
    const error = validateProfileDraft(draft);
    if (error) throw new Error(error);
    const payload = profileInput(draft, this.initial.version);
    if (this.unknown && this.pending && JSON.stringify(payload) !== JSON.stringify(this.pending))
      throw new Error('上次保存结果尚未确认，请先重试原操作');
    try {
      if (this.unknown && this.pending) {
        const latest = await api.profile(signal);
        this.assertActive(signal);
        this.assertOwner(latest);
        if (
          latest.version > this.initial.version &&
          latest.nickname === payload.nickname &&
          latest.avatar_media_id === payload.avatar_media_id
        ) {
          this.completed = latest;
          this.unknown = false;
          return latest;
        }
        if (latest.version !== this.initial.version)
          throw new ApiError('个人资料已更新，请核对最新资料；当前输入已保留', 'http', 409);
      }
      this.pending = payload;
      const profile = await api.patchProfile(payload, signal);
      this.assertActive(signal);
      this.assertOwner(profile);
      this.completed = profile;
      this.unknown = false;
      return profile;
    } catch (error) {
      this.unknown = !(
        error instanceof ApiError &&
        error.kind === 'http' &&
        (error.status ?? 500) < 500
      );
      throw error;
    }
  }
}

/** 同一次头像选择持有同一文件和上传key，失败重试不另建上传。 */
export class AvatarUpload {
  private selection: { path: string; key: string } | null = null;
  select(path: string): void {
    if (path.trim()) this.selection = { path, key: newOperationKey() };
  }
  clear(): void {
    this.selection = null;
  }
  get path(): string | null {
    return this.selection?.path ?? null;
  }
  async upload(session: AuthSession, signal?: AbortSignal) {
    if (!this.selection) throw new Error('请先选择头像');
    if (signal?.aborted || getAuthSession() !== session) throw abortError();
    const selected = this.selection;
    const result = await uploadPrivatePhoto(selected.path, selected.key, 'avatar', signal);
    if (signal?.aborted || getAuthSession() !== session || this.selection !== selected)
      throw abortError();
    return result;
  }
}
