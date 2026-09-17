import { describe, expect, it } from 'vitest';

import type { ApiError } from '../../../shared/api';
import { ResearchHistoryError } from './research-history.gateway';
import {
  mapResearchHistoryPage,
  mapResearchHistoryRecord,
  toResearchHistoryError,
  unwrapResult,
  type ResearchHistoryPageDto,
  type ResearchHistoryRecordDto,
  type ResultDto,
} from './research-history.api';

/**
 * 按 shared/api/api-error.ts 里 isApiError 的真实判据构造：
 * `isRecord(error) && error.__apiError === true && typeof error.message === 'string'`。
 */
function buildApiError(status: number, message = 'server message'): ApiError {
  return { __apiError: true, message, status };
}

const BASE_RECORD_DTO: ResearchHistoryRecordDto = {
  taskId: 'task-1',
  query: '英伟达',
  objectType: 'company',
  objectName: 'NVIDIA Corporation',
  companyName: '英伟达',
  stockCode: 'NVDA',
  market: 'US',
  status: 'COMPLETED',
  conclusion: { decision: 'BUY', confidence: 'HIGH' },
  createdAt: '2026-07-27T10:00:00Z',
};

describe('mapResearchHistoryRecord', () => {
  it('preserves V2.0 report retry fields and capability retryability', () => {
    expect(
      mapResearchHistoryRecord({
        ...BASE_RECORD_DTO,
        status: 'FAILED',
        finalResultAvailable: false,
        synthesisFailed: true,
        capabilities: [
          { name: 'company_profile', status: 'SUCCEEDED', retryable: false },
          { name: 'business_analysis', status: 'SUCCEEDED', retryable: false },
          { name: 'financial_analysis', status: 'SUCCEEDED', retryable: false },
        ],
      }),
    ).toMatchObject({
      status: 'FAILED',
      finalResultAvailable: false,
      synthesisFailed: true,
      capabilities: [
        { name: 'company_profile', status: 'SUCCEEDED', retryable: false },
        { name: 'business_analysis', status: 'SUCCEEDED', retryable: false },
        { name: 'financial_analysis', status: 'SUCCEEDED', retryable: false },
      ],
    });
  });

  it('原样映射所有已识别字段', () => {
    expect(mapResearchHistoryRecord(BASE_RECORD_DTO)).toEqual({
      taskId: 'task-1',
      query: '英伟达',
      objectType: 'company',
      objectName: 'NVIDIA Corporation',
      companyName: '英伟达',
      stockCode: 'NVDA',
      market: 'US',
      status: 'COMPLETED',
      conclusion: { decision: 'BUY', confidence: 'HIGH' },
      createdAt: '2026-07-27T10:00:00Z',
    });
  });

  it('把服务端市场码 A_SHARE 归一为 domain 的 CN', () => {
    const record = mapResearchHistoryRecord({ ...BASE_RECORD_DTO, market: 'A_SHARE' });
    expect(record.market).toBe('CN');
    expect(record.rawMarket).toBeUndefined();
  });

  it('未识别的 market 归一为 unknown 并保留 rawMarket', () => {
    const record = mapResearchHistoryRecord({ ...BASE_RECORD_DTO, market: 'GLOBAL' });
    expect(record.market).toBe('unknown');
    expect(record.rawMarket).toBe('GLOBAL');
  });

  it('market 为 null 时不产出 market 字段（任务尚未解析出市场）', () => {
    const record = mapResearchHistoryRecord({ ...BASE_RECORD_DTO, market: null });
    expect(record.market).toBeUndefined();
    expect(record.rawMarket).toBeUndefined();
  });

  it('未识别的 objectType 归一为 unknown 并保留 rawObjectType', () => {
    const record = mapResearchHistoryRecord({ ...BASE_RECORD_DTO, objectType: 'FUTURE_TYPE' });
    expect(record.objectType).toBe('unknown');
    expect(record.rawObjectType).toBe('FUTURE_TYPE');
  });

  it('未识别的 status 归一为 unknown 并保留 rawStatus', () => {
    const record = mapResearchHistoryRecord({ ...BASE_RECORD_DTO, status: 'SOMETHING_NEW' });
    expect(record.status).toBe('unknown');
    expect(record.rawStatus).toBe('SOMETHING_NEW');
  });

  it('把 V1.1 终态归一为页面已有语义', () => {
    expect(mapResearchHistoryRecord({ ...BASE_RECORD_DTO, status: 'SUCCEEDED' }).status).toBe(
      'COMPLETED',
    );
    expect(mapResearchHistoryRecord({ ...BASE_RECORD_DTO, status: 'PARTIAL_FAILED' }).status).toBe(
      'PARTIAL',
    );
    expect(mapResearchHistoryRecord({ ...BASE_RECORD_DTO, status: 'CANCELLED' }).status).toBe(
      'CANCELLED',
    );
  });

  it('conclusion 为 null 时不产出 conclusion 字段（任务未完成，尚无结论）', () => {
    const record = mapResearchHistoryRecord({ ...BASE_RECORD_DTO, conclusion: null });
    expect(record.conclusion).toBeUndefined();
  });

  it('conclusion 里未识别的 decision/confidence 各自归一为 unknown', () => {
    const record = mapResearchHistoryRecord({
      ...BASE_RECORD_DTO,
      conclusion: { decision: 'STRONG_BUY', confidence: 'VERY_HIGH' },
    });
    expect(record.conclusion).toEqual({ decision: 'unknown', confidence: 'unknown' });
  });

  it('companyName/stockCode/objectName 缺失时不产出对应字段（进行中任务尚未解析出对象）', () => {
    const record = mapResearchHistoryRecord({
      ...BASE_RECORD_DTO,
      objectName: null,
      companyName: null,
      stockCode: null,
      market: null,
      conclusion: null,
      status: 'ANALYZING',
    });
    expect(record).toEqual({
      taskId: 'task-1',
      query: '英伟达',
      objectType: 'company',
      status: 'ANALYZING',
      createdAt: '2026-07-27T10:00:00Z',
    });
  });
});

describe('mapResearchHistoryPage', () => {
  it('保留分页信息并映射每一条 record', () => {
    const dto: ResearchHistoryPageDto = {
      total: 42,
      page: 1,
      size: 10,
      records: [BASE_RECORD_DTO],
    };

    expect(mapResearchHistoryPage(dto)).toEqual({
      total: 42,
      page: 1,
      size: 10,
      records: [mapResearchHistoryRecord(BASE_RECORD_DTO)],
    });
  });
});

describe('unwrapResult', () => {
  it('code 为 200 时返回 data', () => {
    const envelope: ResultDto<{ value: number }> = {
      code: 200,
      message: 'success',
      data: { value: 1 },
    };

    expect(unwrapResult(envelope)).toEqual({ value: 1 });
  });

  it('code 非 200 时抛出 ResearchHistoryError，归为 generic，且 serverMessage 是响应的 message', () => {
    const envelope: ResultDto<null> = { code: 50000, message: '服务异常', data: null };

    let caught: unknown;
    try {
      unwrapResult(envelope);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ResearchHistoryError);
    expect((caught as ResearchHistoryError).code).toBe('generic');
    expect((caught as ResearchHistoryError).serverMessage).toBe('服务异常');
  });
});

describe('toResearchHistoryError', () => {
  it('403 归为 FORBIDDEN（无权删除他人记录）', () => {
    const error = toResearchHistoryError(buildApiError(403, '无权操作'));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.serverMessage).toBe('无权操作');
  });

  it('404 归为 NOT_FOUND（记录不存在）', () => {
    const error = toResearchHistoryError(buildApiError(404, '记录不存在'));
    expect(error.code).toBe('NOT_FOUND');
    expect(error.serverMessage).toBe('记录不存在');
  });

  it('500 归为 generic 且保留服务端消息', () => {
    const error = toResearchHistoryError(buildApiError(500, '服务器开小差了'));
    expect(error.code).toBe('generic');
    expect(error.serverMessage).toBe('服务器开小差了');
  });

  it('非 API 错误（普通 Error）归为 generic', () => {
    const error = toResearchHistoryError(new Error('network down'));
    expect(error.code).toBe('generic');
  });

  it('传入的已经是 ResearchHistoryError 时原样返回', () => {
    const original = new ResearchHistoryError('NOT_FOUND', '原始消息');
    expect(toResearchHistoryError(original)).toBe(original);
  });
});
