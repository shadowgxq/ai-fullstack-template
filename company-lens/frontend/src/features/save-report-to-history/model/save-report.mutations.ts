import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { saveReportGateway } from './save-report.source';

/**
 * 把匿名期间创建的任务绑定到当前账户。
 *
 * 需求 19.2 第 1 条：只绑定现有任务，不重新执行研究——所以这里只有一次绑定请求，
 * 不触碰任何研究创建能力。
 */
export function useBindTaskToAccount(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: (taskId: string) => saveReportGateway.bindTaskToAccount(taskId),
  });
}
