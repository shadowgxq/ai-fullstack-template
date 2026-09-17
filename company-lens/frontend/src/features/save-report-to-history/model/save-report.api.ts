import { isApiError, request } from '../../../shared/api';
import { isSaveReportError, SaveReportError, type SaveReportGateway } from './save-report.gateway';

/**
 * 真实「保存报告到历史」API 数据源实现。
 *
 * 契约来源：`specs/api-specs/产品服务接口文档.md` `POST /api/v1/research/tasks/{taskId}/bind`
 * （相对本文件所在的 frontend 工作目录是 `../specs/api-specs/产品服务接口文档.md`）。
 *
 * - 后端统一返回 `Result<T>` 信封 `{ code, message, data }`，`code !== 200` 视为业务失败。
 * - Base URL 统一前缀 `/api/v1`；项目 `VITE_API_BASE_URL=/api`，因此这里的请求路径写
 *   `/v1/research/tasks/{taskId}/bind`。
 * - 鉴权：调用前必须已登录，`Authorization: Bearer <JWT>` 由 `shared/api` 的请求拦截器统一
 *   附加，这里不用关心。
 * - 响应体 `{ taskId, userId, boundAt }` 组件不消费任何字段（点击后只关心「成功/失败」），
 *   不为了看起来完整而声明一个没人读取的 domain type，直接 `Promise<void>`——与
 *   `research-history` 的 `deleteHistoryRecord`、`auth` 的 `logout` 同一模式。
 * - 解包与错误归一照 `features/research-history` 的 `research-history.api.ts` 同一模式：
 *   `unwrapResult` 只负责判断业务 code；HTTP 层错误（400/401/404）语义在文档和后端源码里
 *   已经明确，直接按 status 归一。
 */

const TASKS_BASE = '/v1/research/tasks';

export type ResultDto<TData> = {
  code: number;
  message?: string | null;
  msg?: string | null;
  errorCode?: string | null;
  data: TData;
};

/** 解包 Result<T> 信封；code !== 200 视为业务失败。 */
export function unwrapResult<TData>(envelope: ResultDto<TData>): TData {
  if (envelope.code !== 200) {
    throw new SaveReportError('generic', envelope.message ?? envelope.msg ?? undefined, {
      apiCode: envelope.code,
      ...(envelope.errorCode ? { errorCode: envelope.errorCode } : {}),
    });
  }
  return envelope.data;
}

/**
 * 把请求层抛出的异常归一为 SaveReportError：
 * - 已经是 SaveReportError（如 unwrapResult 抛出的业务失败）原样返回；
 * - 400 → ALREADY_BOUND：bind 接口目前唯一的业务失败分支就是任务已绑定账户
 *   （backend/product-server 的 ResearchTaskService#bindToUser 只在 `userId != null` 时
 *   抛出 400，见该方法源码；文档里「任务不属于本设备」是同一个错误码在文档层面的另一种表述）；
 * - 401 → UNAUTHENTICATED：调用前应已登录，出现即代表会话已失效；
 * - 404 → NOT_FOUND：任务不存在；
 * - 其余 isApiError（如 5xx）归为 generic，但保留服务端消息；
 * - 非 API 错误（网络异常等）归为 generic，不暴露内部消息。
 */
export function toSaveReportError(error: unknown): SaveReportError {
  if (isSaveReportError(error)) {
    return error;
  }
  if (isApiError(error)) {
    if (error.status === 400) {
      return new SaveReportError('ALREADY_BOUND', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    if (error.status === 401) {
      return new SaveReportError('UNAUTHENTICATED', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    if (error.status === 404) {
      return new SaveReportError('NOT_FOUND', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    return new SaveReportError('generic', error.message, {
      status: error.status,
      apiCode: error.code,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
  }
  return new SaveReportError('generic');
}

export const apiSaveReportGateway: SaveReportGateway = {
  async bindTaskToAccount(taskId: string): Promise<void> {
    try {
      const envelope = await request<ResultDto<unknown>>({
        method: 'POST',
        url: `${TASKS_BASE}/${encodeURIComponent(taskId)}/bind`,
      });
      unwrapResult(envelope);
    } catch (error) {
      throw toSaveReportError(error);
    }
  },
};
