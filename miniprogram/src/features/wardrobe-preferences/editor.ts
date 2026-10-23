import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { ApiError, abortError } from '../../shared/api/errors';
import {
  draftFromPreferences,
  preferencesApi,
  preferencesInput,
  type Preferences,
  type PreferencesPut,
} from './api';
import type { PreferencesDraft } from './draft';

/** 固定打开时的版本；未知结果只核对原操作，不能用新版本悄悄覆盖。 */
export class PreferencesEditor {
  private pending: PreferencesPut | null = null;
  private unknown = false;
  private completed: Preferences | null = null;
  private closed = false;
  constructor(
    private readonly session: AuthSession,
    private readonly initial: Preferences,
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
  async save(draft: PreferencesDraft, signal?: AbortSignal): Promise<Preferences> {
    this.assertActive(signal);
    if (this.completed) return this.completed;
    const payload = preferencesInput(draft, this.initial.version);
    if (this.unknown && this.pending && JSON.stringify(payload) !== JSON.stringify(this.pending))
      throw new Error('上次保存结果尚未确认，请先重试原操作');
    try {
      if (this.unknown && this.pending) {
        const latest = await preferencesApi.read(signal);
        this.assertActive(signal);
        if (
          latest.version > this.initial.version &&
          JSON.stringify(preferencesInput(draftFromPreferences(latest), this.initial.version)) ===
            JSON.stringify(this.pending)
        ) {
          this.completed = latest;
          this.unknown = false;
          return latest;
        }
        if (latest.version !== this.initial.version)
          throw new ApiError('偏好已更新，请核对最新偏好；当前选择已保留', 'http', 409);
      }
      this.pending = payload;
      const result = await preferencesApi.save(payload, signal);
      this.assertActive(signal);
      this.completed = result;
      this.unknown = false;
      return result;
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
