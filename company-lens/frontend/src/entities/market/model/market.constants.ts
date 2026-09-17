import type { MarketCode } from './market.types';

/** 支持的目标市场，数组顺序即 UI 展示顺序（美股默认）。 */
export const MARKET_CODES = ['US', 'CN', 'HK', 'JP', 'KR'] as const satisfies readonly MarketCode[];

export const DEFAULT_MARKET_CODE: MarketCode = 'US';

/** 各市场的 i18n 文案 key（文案见 locales `market.*`）。 */
export const MARKET_LABEL_KEY = {
  US: 'market.US',
  CN: 'market.CN',
  HK: 'market.HK',
  JP: 'market.JP',
  KR: 'market.KR',
} as const satisfies Record<MarketCode, string>;
