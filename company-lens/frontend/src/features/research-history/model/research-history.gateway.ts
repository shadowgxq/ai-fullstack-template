import type { ListResearchHistoryParams, ResearchHistoryPage } from './research-history.types';

/**
 * mock 与真实 API 共同实现的历史分析数据源接口；切换见 research-history.source.ts。
 * 与 `features/auth` 的 `AuthGateway` 同一模式（见 auth.gateway.ts）。
 */
export type ResearchHistoryGateway = {
  listHistory: (params: ListResearchHistoryParams) => Promise<ResearchHistoryPage>;
  deleteHistoryRecord: (taskId: string) => Promise<void>;
  retryReport: (taskId: string) => Promise<void>;
};

/**
 * UI 可稳定映射文案的错误码。
 * FORBIDDEN / NOT_FOUND 对应文档明确给出的删除失败语义（403 无权删除他人记录、404 记录不存在）；
 * 其余情况一律归为 generic。
 */
export type ResearchHistoryErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'generic';

export class ResearchHistoryError extends Error {
  readonly code: ResearchHistoryErrorCode;
  /** 服务端返回的人类可读消息（generic 时用于兜底展示）。 */
  readonly serverMessage?: string;
  readonly status?: number;
  readonly apiCode?: string | number;
  readonly errorCode?: string;

  constructor(
    code: ResearchHistoryErrorCode,
    serverMessage?: string,
    options?: { status?: number; apiCode?: string | number; errorCode?: string },
  ) {
    super(serverMessage || code);
    this.name = 'ResearchHistoryError';
    this.code = code;
    this.serverMessage = serverMessage;
    this.status = options?.status;
    this.apiCode = options?.apiCode;
    this.errorCode = options?.errorCode;
  }
}

export function isResearchHistoryError(error: unknown): error is ResearchHistoryError {
  return error instanceof ResearchHistoryError;
}
