import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { researchHistoryGateway } from './research-history.source';
import type { ResearchHistoryPage } from './research-history.types';

export const RESEARCH_HISTORY_PAGE_SIZE = 10;
export const RESEARCH_HISTORY_PREVIEW_SIZE = 3;

export type ResearchHistoryAccessMode = 'preview' | 'full';

export const researchHistoryQueryKeys = {
  all: () => ['research-history'] as const,
  list: (identityScope: string, accessMode: ResearchHistoryAccessMode, keyword: string) =>
    ['research-history', 'list', identityScope, accessMode, keyword] as const,
};

export type UseResearchHistoryListParams = {
  /** 已防抖的搜索关键词；空字符串表示不过滤，直接透传给服务端 keyword 参数。 */
  keyword: string;
  /** `preview` 只返回并展示有限记录，`full` 开启完整分页。 */
  accessMode: ResearchHistoryAccessMode;
  /** 用用户或设备标识隔离 Query cache，避免登录切换时复用其他主体的记录。 */
  identityScope: string;
};

/**
 * 历史分析列表，「加载更多」分页：用 `useInfiniteQuery` 按页累加记录。
 * 选择加载更多而不是页码分页的理由见 pages/history/HistoryPage 的实现说明。
 */
export function useResearchHistoryList(
  params: UseResearchHistoryListParams,
): UseInfiniteQueryResult<InfiniteData<ResearchHistoryPage>, Error> {
  const { keyword, accessMode, identityScope } = params;
  const pageSize =
    accessMode === 'preview' ? RESEARCH_HISTORY_PREVIEW_SIZE : RESEARCH_HISTORY_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: researchHistoryQueryKeys.list(identityScope, accessMode, keyword),
    queryFn: ({ pageParam }) =>
      researchHistoryGateway.listHistory({
        keyword: keyword || undefined,
        page: pageParam,
        size: pageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (accessMode === 'preview') {
        return undefined;
      }
      return lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined;
    },
    // 只在同一个用户/设备与访问模式内沿用搜索结果，避免登录切换时短暂展示旧主体数据。
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey;
      const isSameAccess = previousKey?.[2] === identityScope && previousKey?.[3] === accessMode;
      return isSameAccess ? previousData : undefined;
    },
  });
}

/**
 * 从已加载的分页缓存里移除一条记录（按 taskId），并把每一页的 total 同步减一。
 * 纯函数：供 useDeleteResearchHistoryRecord 的 setQueryData 调用，也单独覆盖测试，
 * 不需要真的挂载组件或走网络就能验证「删除后列表更新」的核心逻辑。
 */
export function removeResearchHistoryRecord(
  data: InfiniteData<ResearchHistoryPage>,
  taskId: string,
): InfiniteData<ResearchHistoryPage> {
  const containsRecord = data.pages.some((page) =>
    page.records.some((record) => record.taskId === taskId),
  );
  if (!containsRecord) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      total: Math.max(page.total - 1, 0),
      records: page.records.filter((record) => record.taskId !== taskId),
    })),
  };
}

/**
 * 删除一条历史记录。成功后直接 patch 当前 keyword 对应的缓存（就地移除），
 * 不整体 invalidate/refetch——避免删除瞬间列表闪烁或丢失已加载的「加载更多」页数。
 */
export function useDeleteResearchHistoryRecord(
  keyword: string,
  identityScope: string,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => researchHistoryGateway.deleteHistoryRecord(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.setQueryData<InfiniteData<ResearchHistoryPage>>(
        researchHistoryQueryKeys.list(identityScope, 'full', keyword),
        (data) => (data ? removeResearchHistoryRecord(data, taskId) : data),
      );
    },
  });
}

export function useRetryResearchHistoryReport(
  identityScope: string,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => researchHistoryGateway.retryReport(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['research-history', 'list', identityScope],
      });
    },
  });
}
