import { ApiError, errorMessage } from '../../shared/api/errors';
export function weatherError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 42270) return '该城市已不可用，请重新搜索选择';
    if (error.code === 42271) return '无法唯一确认所在地区，请手动搜索城市';
    if (error.code === 42272 || error.code === 40970) return '城市目录或搜索条件已变化，请重新搜索';
    if (error.code === 50371) return '定位服务暂时不可用，请手动搜索城市';
    if (error.code === 50372) return '城市目录暂时不可用，请稍后重试';
  }
  return errorMessage(error);
}
