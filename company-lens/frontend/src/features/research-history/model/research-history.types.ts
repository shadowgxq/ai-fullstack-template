import type { MarketCode } from '../../../entities/market';

/**
 * 公司研究历史记录的领域类型。
 *
 * 契约来源：`specs/api-specs/产品服务接口文档.md` 第 5 节「历史分析」与附录 `TaskVO` 完整结构
 * （相对本文件所在的 frontend 工作目录是 `../specs/api-specs/产品服务接口文档.md`）。
 *
 * 这是独立于 `entities/research`（旧 sector-alpha 行业/主题研究项目模型）的另一套后端契约，
 * 字段、枚举和状态机完全不同，因此不复用 `entities/research` 的类型或数据源，只共享
 * `entities/market` 的市场代码。
 */

/** 对应 TaskVO.objectType；`unknown` 兜底服务端新增或未识别的取值。 */
export type ResearchHistoryObjectType =
  | 'company'
  | 'person'
  | 'product'
  | 'brand'
  | 'subsidiary'
  | 'business'
  | 'unknown';

/** 对应 TaskVO.status；`unknown` 兜底服务端新增或未识别的取值。 */
export type ResearchHistoryStatus =
  | 'PENDING'
  | 'RESOLVING'
  | 'COLLECTING'
  | 'ANALYZING'
  | 'SYNTHESIZING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'unknown';

/** 对应 TaskVO.conclusion.decision（BUY / HOLD / AVOID）。 */
export type ResearchHistoryDecision = 'BUY' | 'HOLD' | 'AVOID' | 'unknown';

/** 对应 TaskVO.conclusion.confidence（HIGH / MEDIUM / LOW）。 */
export type ResearchHistoryConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'unknown';

export type ResearchHistoryCapabilityStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DISABLED'
  | 'unknown';

export type ResearchHistoryCapability = {
  name: string;
  status: ResearchHistoryCapabilityStatus;
  retryable?: boolean;
};

/**
 * 只保留列表卡片消费的两个字段（decision、confidence）。
 * `companyQuality` 是详情接口才有的字段，历史列表接口不返回，不在此臆造。
 */
export type ResearchHistoryConclusion = {
  decision: ResearchHistoryDecision;
  confidence: ResearchHistoryConfidence;
};

/** 市场码，含服务端 `A_SHARE` 归一到 `CN` 之后的结果；`unknown` 兜底未识别取值。 */
export type ResearchHistoryMarket = MarketCode | 'unknown';

export type ResearchHistoryRecord = {
  taskId: string;
  /** 用户原始输入，即需求文档 20.2 的「原始研究对象」。 */
  query: string;
  objectType: ResearchHistoryObjectType;
  rawObjectType?: string;
  /** 标准化对象名称；任务尚未解析出对象时服务端可能不返回。 */
  objectName?: string;
  companyName?: string;
  stockCode?: string;
  market?: ResearchHistoryMarket;
  rawMarket?: string;
  status: ResearchHistoryStatus;
  rawStatus?: string;
  /** V2.0：最终报告是否已经可用；报告重试的前置条件要求为 false。 */
  finalResultAvailable?: boolean;
  /** V2.0：是否曾在 synthesis 阶段失败。 */
  synthesisFailed?: boolean;
  /** V2.0：历史列表使用 capabilities[] 判断两类重试按钮。 */
  capabilities?: readonly ResearchHistoryCapability[];
  /**
   * 需求文档 20.2 要求展示「研究重点」，但 `GET /research/history` 列表接口只返回本类型
   * 列出的字段（taskId/query/objectType/objectName/companyName/stockCode/market/status/
   * conclusion/createdAt），不含研究重点——该字段只存在于任务详情接口。按现有后端契约不
   * 展示这一项，不为了凑齐字段数去调详情接口或编造内容。
   */
  conclusion?: ResearchHistoryConclusion;
  /** ISO 8601。 */
  createdAt: string;
};

export type ResearchHistoryPage = {
  total: number;
  page: number;
  size: number;
  records: readonly ResearchHistoryRecord[];
};

/**
 * 需求文档 20.3 描述的是前端对「原始研究对象/公司名称/公司全称/股票代码/管理层姓名/产品
 * 名称/业务名称」七个字段做多关键词 AND 匹配，但后端 `GET /research/history` 已经提供服务端
 * `keyword` 搜索（只匹配 query / objectName，单一关键词，非多词 AND）。这里直接透传单一
 * keyword 给服务端，不在前端重复实现一套多关键词匹配逻辑。
 */
export type ListResearchHistoryParams = {
  keyword?: string;
  page?: number;
  size?: number;
};
