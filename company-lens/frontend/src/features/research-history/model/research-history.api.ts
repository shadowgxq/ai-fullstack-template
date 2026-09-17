import { isApiError, request } from '../../../shared/api';
import {
  isResearchHistoryError,
  ResearchHistoryError,
  type ResearchHistoryGateway,
} from './research-history.gateway';
import type {
  ListResearchHistoryParams,
  ResearchHistoryCapability,
  ResearchHistoryCapabilityStatus,
  ResearchHistoryConclusion,
  ResearchHistoryConfidence,
  ResearchHistoryDecision,
  ResearchHistoryMarket,
  ResearchHistoryObjectType,
  ResearchHistoryPage,
  ResearchHistoryRecord,
  ResearchHistoryStatus,
} from './research-history.types';

/**
 * 真实历史分析 API 数据源实现。
 *
 * 契约来源：`specs/api-specs/产品服务接口文档.md` 第 5 节「历史分析」与附录 `TaskVO` 完整结构
 * （相对本文件所在的 frontend 工作目录是 `../specs/api-specs/产品服务接口文档.md`）。
 *
 * - 后端统一返回 `Result<T>` 信封 `{ code, message, data }`，`code !== 200` 视为业务失败。
 * - Base URL 统一前缀 `/api/v1`；项目 `VITE_API_BASE_URL=/api`，因此这里的请求路径写
 *   `/v1/research/history`。
 * - 鉴权：已登录带 `Authorization: Bearer <JWT>`，未登录带 `X-Device-Id`；两者都由
 *   `shared/api` 的请求拦截器统一处理，这里不用关心。
 * - 解包与错误归一照 `features/auth` 的 `auth.api.ts`（`unwrapResult`/`toXxxError`）同一模式：
 *   `unwrapResult` 只负责判断业务 code；HTTP 层错误（403/404）语义已经在文档里明确，比 auth 场景
 *   更确定，因此 `toResearchHistoryError` 不需要调用方传入 fallback 码，直接按 HTTP status 归一。
 */

const HISTORY_BASE = '/v1/research/history';
const TASKS_BASE = '/v1/research/tasks';

export type ResultDto<TData> = {
  code: number;
  message?: string | null;
  msg?: string | null;
  errorCode?: string | null;
  data: TData;
};

/** 对应文档附录 `TaskVO.conclusion`；历史列表只填充 decision/confidence，不含 companyQuality。 */
export type ResearchHistoryConclusionDto = {
  decision?: string | null;
  confidence?: string | null;
} | null;

/** 对应文档 5.1 响应示例里的单条 record（TaskVO 的列表投影）。 */
export type ResearchHistoryRecordDto = {
  taskId: string;
  query: string;
  objectType?: string | null;
  objectName?: string | null;
  companyName?: string | null;
  stockCode?: string | null;
  market?: string | null;
  status: string;
  finalResultAvailable?: boolean | null;
  synthesisFailed?: boolean | null;
  final_result_available?: boolean | null;
  synthesis_failed?: boolean | null;
  capabilities?: readonly ResearchHistoryCapabilityDto[] | null;
  conclusion?: ResearchHistoryConclusionDto;
  createdAt: string;
};

export type ResearchHistoryCapabilityDto = {
  name?: string | null;
  status?: string | null;
  retryable?: boolean | null;
};

export type ResearchHistoryPageDto = {
  total: number;
  page: number;
  size: number;
  records: readonly ResearchHistoryRecordDto[];
};

const OBJECT_TYPES = new Set<string>([
  'company',
  'person',
  'product',
  'brand',
  'subsidiary',
  'business',
]);

function mapObjectType(rawObjectType: string | null | undefined): {
  objectType: ResearchHistoryObjectType;
  rawObjectType?: string;
} {
  const normalized = rawObjectType?.trim().toLowerCase();
  if (normalized && OBJECT_TYPES.has(normalized)) {
    return { objectType: normalized as ResearchHistoryObjectType };
  }
  return rawObjectType ? { objectType: 'unknown', rawObjectType } : { objectType: 'unknown' };
}

function mapStatus(rawStatus: string): { status: ResearchHistoryStatus; rawStatus?: string } {
  switch (rawStatus) {
    case 'SUCCEEDED':
    case 'COMPLETED':
      return { status: 'COMPLETED' };
    case 'PARTIAL_FAILED':
    case 'PARTIAL':
      return { status: 'PARTIAL' };
    case 'PENDING':
    case 'RESOLVING':
    case 'COLLECTING':
    case 'ANALYZING':
    case 'SYNTHESIZING':
    case 'FAILED':
    case 'CANCELLED':
      return { status: rawStatus };
    default:
      return { status: 'unknown', rawStatus };
  }
}

function mapCapabilityStatus(
  rawStatus: string | null | undefined,
): ResearchHistoryCapabilityStatus {
  switch (rawStatus?.trim().toUpperCase()) {
    case 'PENDING':
    case 'WAITING':
      return 'PENDING';
    case 'RUNNING':
      return 'RUNNING';
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'COMPLETED':
      return 'SUCCEEDED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'DISABLED':
    case 'NOT_ENABLED':
      return 'DISABLED';
    default:
      return 'unknown';
  }
}

function mapCapabilities(
  rawCapabilities: readonly ResearchHistoryCapabilityDto[] | null | undefined,
): readonly ResearchHistoryCapability[] | undefined {
  if (!Array.isArray(rawCapabilities)) return undefined;
  return rawCapabilities.flatMap((capability) => {
    const name = capability.name?.trim();
    if (!name) return [];
    return [
      {
        name,
        status: mapCapabilityStatus(capability.status),
        ...(typeof capability.retryable === 'boolean' ? { retryable: capability.retryable } : {}),
      },
    ];
  });
}

/** `A_SHARE` 是后端市场码，归一到 domain 的 `CN`（见 entities/market 的 MarketCode 注释）。 */
function mapMarket(rawMarket: string | null | undefined): {
  market?: ResearchHistoryMarket;
  rawMarket?: string;
} {
  switch (rawMarket) {
    case 'US':
    case 'HK':
    case 'JP':
    case 'KR':
      return { market: rawMarket };
    case 'A_SHARE':
      return { market: 'CN' };
    case null:
    case undefined:
      return {};
    default:
      return { market: 'unknown', rawMarket };
  }
}

function mapDecision(rawDecision: string | null | undefined): ResearchHistoryDecision {
  return rawDecision === 'BUY' || rawDecision === 'HOLD' || rawDecision === 'AVOID'
    ? rawDecision
    : 'unknown';
}

function mapConfidence(rawConfidence: string | null | undefined): ResearchHistoryConfidence {
  return rawConfidence === 'HIGH' || rawConfidence === 'MEDIUM' || rawConfidence === 'LOW'
    ? rawConfidence
    : 'unknown';
}

function mapConclusion(dto: ResearchHistoryConclusionDto): ResearchHistoryConclusion | undefined {
  if (!dto) {
    return undefined;
  }
  return {
    decision: mapDecision(dto.decision),
    confidence: mapConfidence(dto.confidence),
  };
}

export function mapResearchHistoryRecord(dto: ResearchHistoryRecordDto): ResearchHistoryRecord {
  const conclusion = mapConclusion(dto.conclusion ?? null);
  const capabilities = mapCapabilities(dto.capabilities);
  const finalResultAvailable = dto.finalResultAvailable ?? dto.final_result_available;
  const synthesisFailed = dto.synthesisFailed ?? dto.synthesis_failed;

  return {
    taskId: dto.taskId,
    query: dto.query,
    ...mapObjectType(dto.objectType),
    ...(dto.objectName ? { objectName: dto.objectName } : {}),
    ...(dto.companyName ? { companyName: dto.companyName } : {}),
    ...(dto.stockCode ? { stockCode: dto.stockCode } : {}),
    ...mapMarket(dto.market),
    ...mapStatus(dto.status),
    ...(typeof finalResultAvailable === 'boolean' ? { finalResultAvailable } : {}),
    ...(typeof synthesisFailed === 'boolean' ? { synthesisFailed } : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
    ...(conclusion ? { conclusion } : {}),
    createdAt: dto.createdAt,
  };
}

export function mapResearchHistoryPage(dto: ResearchHistoryPageDto): ResearchHistoryPage {
  return {
    total: dto.total,
    page: dto.page,
    size: dto.size,
    records: dto.records.map(mapResearchHistoryRecord),
  };
}

/** 解包 Result<T> 信封；code !== 200 视为业务失败。 */
export function unwrapResult<TData>(envelope: ResultDto<TData>): TData {
  if (envelope.code !== 200) {
    throw new ResearchHistoryError('generic', envelope.message ?? envelope.msg ?? undefined, {
      apiCode: envelope.code,
      ...(envelope.errorCode ? { errorCode: envelope.errorCode } : {}),
    });
  }
  return envelope.data;
}

/**
 * 把请求层抛出的异常归一为 ResearchHistoryError：
 * - 已经是 ResearchHistoryError（如 unwrapResult 抛出的业务失败）原样返回；
 * - 403（无权删除他人记录）→ FORBIDDEN；404（记录不存在）→ NOT_FOUND；
 * - 其余 isApiError（如 5xx）归为 generic，但保留服务端消息；
 * - 非 API 错误（网络异常等）归为 generic，不暴露内部消息。
 */
export function toResearchHistoryError(error: unknown): ResearchHistoryError {
  if (isResearchHistoryError(error)) {
    return error;
  }
  if (isApiError(error)) {
    if (error.status === 403) {
      return new ResearchHistoryError('FORBIDDEN', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    if (error.status === 404) {
      return new ResearchHistoryError('NOT_FOUND', error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    return new ResearchHistoryError('generic', error.message, {
      status: error.status,
      apiCode: error.code,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
  }
  return new ResearchHistoryError('generic');
}

function buildListQuery(params: ListResearchHistoryParams): Record<string, string | number> {
  const trimmedKeyword = params.keyword?.trim();
  return {
    ...(trimmedKeyword ? { keyword: trimmedKeyword } : {}),
    ...(params.page ? { page: params.page } : {}),
    ...(params.size ? { size: params.size } : {}),
  };
}

export const apiResearchHistoryGateway: ResearchHistoryGateway = {
  async listHistory(params: ListResearchHistoryParams): Promise<ResearchHistoryPage> {
    try {
      const envelope = await request<ResultDto<ResearchHistoryPageDto>>({
        method: 'GET',
        url: HISTORY_BASE,
        params: buildListQuery(params),
      });
      return mapResearchHistoryPage(unwrapResult(envelope));
    } catch (error) {
      throw toResearchHistoryError(error);
    }
  },

  async deleteHistoryRecord(taskId: string): Promise<void> {
    try {
      const envelope = await request<ResultDto<unknown>>({
        method: 'DELETE',
        url: `${HISTORY_BASE}/${encodeURIComponent(taskId)}`,
      });
      unwrapResult(envelope);
    } catch (error) {
      throw toResearchHistoryError(error);
    }
  },

  async retryReport(taskId: string): Promise<void> {
    try {
      const envelope = await request<ResultDto<unknown>>({
        method: 'POST',
        url: `${TASKS_BASE}/${encodeURIComponent(taskId)}/retry-report`,
      });
      unwrapResult(envelope);
    } catch (error) {
      throw toResearchHistoryError(error);
    }
  },
};
