import type { MarketCode } from '../../../entities/market';
import { MAX_RESEARCH_QUERY_LENGTH } from './research-launch.constants';

export type ResearchQueryOrigin = 'typed' | 'suggestion';

export type StockSearchEligibility = {
  query: string;
  market: MarketCode;
  origin: ResearchQueryOrigin;
  hasSelectedStock: boolean;
  isInteractionLocked: boolean;
};

const MAX_STOCK_SEARCH_QUERY_LENGTH = 40;
const STOCK_SEARCH_MARKETS = new Set<MarketCode>(['US', 'HK']);
const NATURAL_LANGUAGE_PREFIXES = [
  '帮我',
  '请',
  '我想',
  '想了解',
  '分析',
  '研究',
  '看看',
  '评估',
  '比较',
  '对比',
  '筛选',
  '寻找',
  '找出',
  '哪些',
  '什么',
  '如何',
  '为什么',
  '是否',
  'please',
  'analyze',
  'research',
  'compare',
  'find',
  'screen',
  'what',
  'which',
  'how',
  'why',
  'should',
] as const;
const NATURAL_LANGUAGE_PUNCTUATION = /[?？!！。；;，,\r\n]/u;

export function getResearchQueryLength(query: string): number {
  return Array.from(query).length;
}

export function limitResearchQuery(query: string) {
  const codePoints = Array.from(query);
  if (codePoints.length <= MAX_RESEARCH_QUERY_LENGTH) {
    return { value: query, length: codePoints.length, wasTruncated: false };
  }

  return {
    value: codePoints.slice(0, MAX_RESEARCH_QUERY_LENGTH).join(''),
    length: MAX_RESEARCH_QUERY_LENGTH,
    wasTruncated: true,
  };
}

export function shouldSearchStockCandidates({
  query,
  market,
  origin,
  hasSelectedStock,
  isInteractionLocked,
}: StockSearchEligibility): boolean {
  const normalizedQuery = query.trim();
  if (
    !normalizedQuery ||
    origin === 'suggestion' ||
    hasSelectedStock ||
    isInteractionLocked ||
    !STOCK_SEARCH_MARKETS.has(market) ||
    Array.from(normalizedQuery).length > MAX_STOCK_SEARCH_QUERY_LENGTH ||
    NATURAL_LANGUAGE_PUNCTUATION.test(normalizedQuery)
  ) {
    return false;
  }

  const lowerCaseQuery = normalizedQuery.toLocaleLowerCase();
  return !NATURAL_LANGUAGE_PREFIXES.some((prefix) => lowerCaseQuery.startsWith(prefix));
}
