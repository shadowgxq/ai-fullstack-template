import { describe, expect, it } from 'vitest';

import { buildShareCopy, SHARE_COPY_MAX_LENGTH } from './share-copy';

describe('share copy', () => {
  it('joins unique plain-text slogans within the share limit', () => {
    const copy = buildShareCopy([
      '# 英伟达：行业结论',
      '**6 个 Agent 联研**',
      '重点候选：英伟达 / 台积电 / Vertiv',
      '最大风险：估值已经进入高波动区间，需要持续验证订单兑现。',
    ]);

    expect(copy).toBe(
      '英伟达：行业结论｜6 个 Agent 联研｜重点候选：英伟达 / 台积电 / Vertiv｜最大风险：估值已经进入高波动区间，需要持续验证订单兑现。',
    );
    expect(Array.from(copy).length).toBeLessThanOrEqual(SHARE_COPY_MAX_LENGTH);
  });

  it('truncates the final slogan instead of appending the remaining report', () => {
    const copy = buildShareCopy(['研究结论', `核心优势：${'长期竞争优势'.repeat(30)}`]);

    expect(Array.from(copy).length).toBe(SHARE_COPY_MAX_LENGTH);
    expect(copy).toMatch(/^研究结论｜核心优势：/);
    expect(copy.endsWith('…')).toBe(true);
  });
});
