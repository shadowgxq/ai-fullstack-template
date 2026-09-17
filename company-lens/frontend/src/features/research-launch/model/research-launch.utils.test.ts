import { describe, expect, it } from 'vitest';

import {
  getResearchQueryLength,
  limitResearchQuery,
  shouldSearchStockCandidates,
} from './research-launch.utils';

describe('research launch rules', () => {
  it.each([
    ['NVDA', 'US', true],
    ['腾讯', 'HK', true],
    ['帮我分析下 NVDA', 'US', false],
    ['Analyze NVIDIA', 'US', false],
    ['NVDA?', 'US', false],
    ['NVDA\nrisks', 'US', false],
    ['NVDA', 'CN', false],
    ['NVDA', 'JP', false],
    ['NVDA', 'KR', false],
  ] as const)(
    'decides whether %s in %s should search stock candidates',
    (query, market, expected) => {
      expect(
        shouldSearchStockCandidates({
          query,
          market,
          origin: 'typed',
          hasSelectedStock: false,
          isInteractionLocked: false,
        }),
      ).toBe(expected);
    },
  );

  it('skips suggestions, selected stocks, locked interactions, and long inputs', () => {
    const baseInput = {
      query: 'NVDA',
      market: 'US' as const,
      origin: 'typed' as const,
      hasSelectedStock: false,
      isInteractionLocked: false,
    };

    expect(shouldSearchStockCandidates({ ...baseInput, origin: 'suggestion' })).toBe(false);
    expect(shouldSearchStockCandidates({ ...baseInput, hasSelectedStock: true })).toBe(false);
    expect(shouldSearchStockCandidates({ ...baseInput, isInteractionLocked: true })).toBe(false);
    expect(shouldSearchStockCandidates({ ...baseInput, query: 'A'.repeat(41) })).toBe(false);
  });

  it('limits research queries to 100 Unicode code points without splitting emoji', () => {
    const limitedQuery = limitResearchQuery(`${'A'.repeat(99)}😀😀`);

    expect(limitedQuery).toEqual({
      value: `${'A'.repeat(99)}😀`,
      length: 100,
      wasTruncated: true,
    });
    expect(getResearchQueryLength(limitedQuery.value)).toBe(100);
  });
});
