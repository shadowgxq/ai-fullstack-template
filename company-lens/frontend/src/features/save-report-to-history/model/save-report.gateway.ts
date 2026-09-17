/**
 * mock 与真实 API 共同实现的「保存报告到历史」数据源接口；切换见 save-report.source.ts。
 * 与 `features/auth` 的 `AuthGateway`、`features/research-history` 的 `ResearchHistoryGateway`
 * 同一模式。
 *
 * 契约来源：`specs/api-specs/产品服务接口文档.md` 1.3「匿名绑定流程」与
 * `POST /api/v1/research/tasks/{taskId}/bind` 章节
 * （相对本文件所在的 frontend 工作目录是 `../specs/api-specs/产品服务接口文档.md`）。
 *
 * 这是独立于 `research-history`（`GET /v1/research/history`，历史列表/删除）的另一个
 * REST 资源（`/research/tasks/{taskId}/bind`，由后端 ResearchRecognitionController 承载），
 * 因此不并入 `ResearchHistoryGateway`，单独成一个 feature（放置理由见组件目录说明）。
 */
export type SaveReportGateway = {
  /**
   * 把匿名/游客期间创建的任务绑定到当前登录账户。
   * 调用前必须已登录——Header 由 `shared/api` 的请求拦截器统一附加 `Authorization: Bearer`，
   * 调用方不需要自己处理。
   */
  bindTaskToAccount: (taskId: string) => Promise<void>;
};

/**
 * UI 可稳定映射文案的错误码。
 * - `ALREADY_BOUND`：对应后端 `ResearchTaskService.bindToUser` 目前唯一的业务失败分支
 *   （任务已经绑定过 userId，见该方法源码），HTTP 400。覆盖需求 19.2 第 2/4 条：同一任务
 *   不能重复保存，已绑定其他账户的任务也不能再次绑定——这两种情况在后端是同一个错误码，
 *   前端不假装能区分「是不是我自己之前存的」，只给出「已绑定账户，无法重复保存」这个
 *   对两种情况都成立的明确原因。
 * - `UNAUTHENTICATED`：对应未登录 401。正常流程下调用方必须已登录才会触发绑定，出现即代表
 *   会话已在两次点击之间失效。
 * - `NOT_FOUND`：对应任务不存在 404。
 * - 其余情况一律归为 `generic`。
 */
export type SaveReportErrorCode = 'ALREADY_BOUND' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'generic';

export class SaveReportError extends Error {
  readonly code: SaveReportErrorCode;
  /** 服务端返回的人类可读消息（generic 时用于兜底展示）。 */
  readonly serverMessage?: string;
  readonly status?: number;
  readonly apiCode?: string | number;
  readonly errorCode?: string;

  constructor(
    code: SaveReportErrorCode,
    serverMessage?: string,
    options?: { status?: number; apiCode?: string | number; errorCode?: string },
  ) {
    super(serverMessage || code);
    this.name = 'SaveReportError';
    this.code = code;
    this.serverMessage = serverMessage;
    this.status = options?.status;
    this.apiCode = options?.apiCode;
    this.errorCode = options?.errorCode;
  }
}

export function isSaveReportError(error: unknown): error is SaveReportError {
  return error instanceof SaveReportError;
}
