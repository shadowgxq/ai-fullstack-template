import { SaveReportError, type SaveReportGateway } from './save-report.gateway';

const MOCK_LATENCY_MS = 280;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 创建一个状态独立的 mock「保存报告」网关。
 *
 * 已绑定任务集合是闭包私有状态，测试可以为每个用例创建全新实例，避免用例间相互污染；
 * 与 `features/auth` 的 `createMockAuthGateway`、`features/research-history` 的
 * `createMockResearchHistoryGateway` 保持同一模式（不使用模块级可变状态）。
 *
 * 一个任务绑定成功后即加入集合，之后任何账户重复绑定同一个任务都会命中 ALREADY_BOUND——
 * 这一份实现同时演示了需求 19.2 第 2 条（同一任务不能重复保存）和第 4 条（已绑定其他账户的
 * 任务不能再次绑定），因为真实后端也不区分「重复绑定的是不是同一个账户」。
 *
 * @param initiallyBoundTaskIds 预置的「已绑定」任务集合，默认为空。
 */
export function createMockSaveReportGateway(
  initiallyBoundTaskIds: readonly string[] = [],
): SaveReportGateway {
  // 闭包私有的可变集合，只属于这一个网关实例。
  const boundTaskIds = new Set(initiallyBoundTaskIds);

  return {
    async bindTaskToAccount(taskId: string): Promise<void> {
      await delay(MOCK_LATENCY_MS);
      if (boundTaskIds.has(taskId)) {
        throw new SaveReportError('ALREADY_BOUND');
      }
      boundTaskIds.add(taskId);
    },
  };
}

/** 应用运行时使用的实例；save-report.source.ts 按 VITE_DATA_SOURCE 单点切换数据源。 */
export const mockSaveReportGateway: SaveReportGateway = createMockSaveReportGateway();
