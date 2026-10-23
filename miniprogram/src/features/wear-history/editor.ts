import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { ApiError, abortError } from '../../shared/api/errors';
import { PendingCreate } from '../wardrobe/draft';
import {
  draftFromWear,
  wearApi,
  wearInput,
  type WearCreate,
  type WearCreated,
  type WearRecord,
} from './api';
import { validateWearDraft, type WearDraft } from './draft';

/** 一个页面草稿拥有一个保存身份，写入成功后仅重试返回，不再写入。 */
export class WearEditor {
  private create = new PendingCreate<WearCreate>();
  private patch: { payload: WearCreate; uncertain: boolean } | null = null;
  private completed: WearCreated | null = null;
  constructor(
    private readonly session: AuthSession,
    private readonly initial?: WearRecord,
  ) {}
  get saved(): boolean {
    return Boolean(this.completed);
  }
  get uncertain(): boolean {
    return this.initial ? Boolean(this.patch?.uncertain) : this.create.uncertain;
  }
  async save(draft: WearDraft, signal?: AbortSignal): Promise<WearCreated> {
    if (signal?.aborted || getAuthSession() !== this.session) throw abortError();
    if (this.completed) return this.completed;
    const validation = validateWearDraft(draft);
    if (validation) throw new Error(validation);
    const payload = wearInput(draft);
    try {
      let result: WearCreated;
      if (this.initial) {
        if (this.patch?.uncertain) {
          if (JSON.stringify(payload) !== JSON.stringify(this.patch.payload))
            throw new Error('上次保存结果尚未确认，请先重试原操作');
          const latest = await wearApi.record(this.initial.id, signal);
          // success 回调 resolve 与 await 续体之间仍可切号或离页。
          if (signal?.aborted || getAuthSession() !== this.session) throw abortError();
          if (
            JSON.stringify(wearInput(draftFromWear(latest))) === JSON.stringify(this.patch.payload)
          ) {
            this.completed = { id: latest.id, version: latest.version };
            this.patch = null;
            return this.completed;
          }
          if (latest.version !== this.initial.version)
            throw new ApiError('记录已被修改，请核对最新记录；当前输入已保留', 'http', 409);
        }
        this.patch = { payload, uncertain: false };
        const record = await wearApi.patch(
          this.initial.id,
          { ...payload, expected_version: this.initial.version },
          signal,
        );
        result = { id: record.id, version: record.version };
      } else {
        const operation = this.create.begin(payload);
        result = await wearApi.create(operation.payload, operation.key, signal);
      }
      if (signal?.aborted || getAuthSession() !== this.session) throw abortError();
      this.completed = result;
      this.create.complete();
      this.patch = null;
      return result;
    } catch (error) {
      if (this.initial && this.patch)
        this.patch.uncertain = !(
          error instanceof ApiError &&
          error.kind === 'http' &&
          (error.status ?? 500) < 500
        );
      else if (!this.initial) this.create.failed(error);
      throw error;
    }
  }
}
