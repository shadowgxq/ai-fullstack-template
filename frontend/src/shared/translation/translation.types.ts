export const TRANSLATION_LANGUAGES = ['en-US', 'zh-CN'] as const;
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export const DEFAULT_TRANSLATION_WAIT_TIMEOUT_MS = 5_000;
export const TRANSLATION_CACHE_STORAGE_KEY = 'onlyif:translation-cache:v1';
export const TRANSLATION_CACHE_SCHEMA_VERSION = 1;
export const TRANSLATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_TRANSLATION_ITEMS = 50;
export const MAX_TRANSLATION_TEXT_CHARS = 5_000;
export const MAX_TRANSLATION_BATCH_BYTES = 90_000;

export type PageTranslationField = Readonly<{
  id: string;
  text?: string | null;
}>;

export type TranslationRequestItem = Readonly<{
  id: string;
  text: string;
}>;

export type TranslationRequest = Readonly<{
  source_lang: TranslationLanguage;
  target_lang: TranslationLanguage;
  items: readonly TranslationRequestItem[];
}>;

export type TranslationResult = Readonly<{
  id: string;
  translated_text: string;
  cache_status: 'hit' | 'translated';
}>;

export type TranslationResponse = Readonly<{
  source_lang: string;
  target_lang: string;
  provider_calls: number;
  items: readonly TranslationResult[];
}>;

export type TranslationMap = Map<string, string>;

export type TranslationCacheEntry = Readonly<{
  translatedText: string;
  cachedAt: number;
  expiresAt: number;
}>;

export type TranslationFieldStatus = 'source' | 'loading' | 'translated' | 'fallback';

export type TranslationFieldView = Readonly<{
  text: string | null;
  status: TranslationFieldStatus;
}>;

export type PageTranslationController = Readonly<{
  resolve: (sourceText?: string | null) => TranslationFieldView;
  isTranslating: boolean;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
}>;
