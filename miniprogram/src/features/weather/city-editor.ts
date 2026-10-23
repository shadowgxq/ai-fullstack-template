import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { api, type Profile, type ProfilePatch } from '../../shared/api/gateway';
import { weatherApi } from './api';
import { ApiError, abortError } from '../../shared/api/errors';

/** 城市只PATCH自身字段；昵称、头像沿服务端当前值保留。 */
export class CityEditor {
  private base: Profile;
  private pending: ProfilePatch | null = null;
  private unknown = false;
  private completed: Profile | null = null;
  private closed = false;
  private latestRead: Profile | null = null;
  constructor(
    private readonly session: AuthSession,
    initial: Profile,
  ) {
    this.base = initial;
  }
  get uncertain(): boolean {
    return this.unknown;
  }
  get saved(): boolean {
    return this.completed !== null;
  }
  close(): void {
    this.closed = true;
  }
  private check(signal?: AbortSignal): void {
    if (this.closed || signal?.aborted || getAuthSession() !== this.session) throw abortError();
  }
  private owner(value: Profile): void {
    if (value.user_id !== this.session.userId)
      throw new ApiError('城市资料账户不匹配', 'invalid-response');
  }
  async readLatest(signal?: AbortSignal): Promise<Profile> {
    this.check(signal);
    const profile = await api.profile(signal);
    this.check(signal);
    this.owner(profile);
    this.latestRead = profile;
    return profile;
  }
  async readLatestSelection(signal?: AbortSignal) {
    const profile = await this.readLatest(signal);
    this.check(signal);
    if (!profile.city_id) return { profile, region: null, unverified: false };
    try {
      const context = await weatherApi.context({ city_id: profile.city_id }, signal);
      this.check(signal);
      if (context.region.city_id !== profile.city_id)
        throw new ApiError('最新城市读取不匹配，请重试', 'invalid-response');
      return { profile, region: context.region, unverified: false };
    } catch (error) {
      this.check(signal);
      // 仅已确认的旧城市不存在可恢复；网络/权限/目录故障仍须重试读取。
      if (error instanceof ApiError && error.code === 42270)
        return { profile, region: null, unverified: true };
      throw error;
    }
  }
  acceptLatest(value: Profile): void {
    this.check();
    if (value !== this.latestRead || value.version < this.base.version || this.unknown)
      throw new Error('请先读取最新资料并确认重试');
    this.base = value;
    this.pending = null;
    this.latestRead = null;
  }
  async save(cityId: string | null, signal?: AbortSignal): Promise<Profile> {
    this.check(signal);
    this.owner(this.base);
    if (this.completed) return this.completed;
    const payload: ProfilePatch = { expected_version: this.base.version, city_id: cityId };
    if (
      this.unknown &&
      this.pending &&
      (this.pending.city_id !== cityId ||
        this.pending.expected_version !== payload.expected_version)
    )
      throw new Error('上次保存结果尚未确认，请先重试原城市');
    try {
      if (this.unknown && this.pending) {
        const latest = await api.profile(signal);
        this.check(signal);
        this.owner(latest);
        if (latest.version > this.base.version && latest.city_id === cityId) {
          this.completed = latest;
          this.unknown = false;
          return latest;
        }
        if (latest.version !== this.base.version)
          throw new ApiError(
            '资料已更新，请核对最新资料后确认重试；当前城市选择已保留',
            'http',
            409,
          );
      }
      this.pending = payload;
      const result = await api.patchProfile(payload, signal);
      this.check(signal);
      this.owner(result);
      if (result.city_id !== cityId)
        throw new ApiError('城市保存结果不匹配，请重试核对', 'invalid-response');
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
