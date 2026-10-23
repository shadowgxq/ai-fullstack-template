import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { abortError } from '../../shared/api/errors';

/** 搜索与选城分别持有最新请求；关闭或换会话后所有结果都失效。 */
export class CityOperations {
  private closed = false;
  private current: Partial<Record<'search' | 'selection', AbortController>> = {};
  constructor(private readonly session: AuthSession) {}
  active(): boolean {
    return !this.closed && getAuthSession() === this.session;
  }
  begin(channel: 'search' | 'selection') {
    if (!this.active()) throw abortError();
    this.current[channel]?.abort();
    if (channel === 'selection') this.current.search?.abort();
    const controller = new AbortController();
    this.current[channel] = controller;
    return {
      signal: controller.signal,
      check: () => {
        if (!this.active() || controller.signal.aborted || this.current[channel] !== controller)
          throw abortError();
      },
    };
  }
  cancelSelection(): void {
    this.current.selection?.abort();
  }
  close(): void {
    this.closed = true;
    this.current.search?.abort();
    this.current.selection?.abort();
  }
}
