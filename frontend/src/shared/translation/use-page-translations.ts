import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useLocale } from '../i18n';
import { translateTexts } from './translation.client';
import { normalizeTranslationText } from './translation.local-cache';
import {
  DEFAULT_TRANSLATION_WAIT_TIMEOUT_MS,
  TRANSLATION_CACHE_TTL_MS,
  type PageTranslationController,
  type PageTranslationField,
  type TranslationFieldView,
  type TranslationLanguage,
} from './translation.types';

const EMPTY_TRANSLATIONS = new Map<string, string>();

function toTranslationLanguage(locale: 'en' | 'zh'): TranslationLanguage {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}

export function usePageTranslations({
  pageKey,
  sourceLanguage,
  fields,
  waitTimeoutMs = DEFAULT_TRANSLATION_WAIT_TIMEOUT_MS,
}: Readonly<{
  pageKey: string;
  sourceLanguage: TranslationLanguage;
  fields: readonly PageTranslationField[];
  waitTimeoutMs?: number;
}>): PageTranslationController {
  const { locale } = useLocale();
  const targetLanguage = toTranslationLanguage(locale);
  const normalizedTexts = useMemo(
    () => [
      ...new Set(
        fields
          .map((field) => normalizeTranslationText(field.text ?? ''))
          .filter((text) => text.length > 0),
      ),
    ],
    [fields],
  );
  const queryTexts = useMemo(() => [...normalizedTexts].sort(), [normalizedTexts]);
  const requestedTexts = useMemo(() => new Set(queryTexts), [queryTexts]);
  const enabled = sourceLanguage !== targetLanguage && queryTexts.length > 0;
  const requestKey = useMemo(
    () => JSON.stringify([pageKey, sourceLanguage, targetLanguage, queryTexts]),
    [pageKey, queryTexts, sourceLanguage, targetLanguage],
  );
  const query = useQuery({
    queryKey: ['onlyif', 'translations', pageKey, sourceLanguage, targetLanguage, queryTexts],
    queryFn: ({ signal }) =>
      translateTexts({ texts: queryTexts, sourceLanguage, targetLanguage, signal }),
    enabled,
    retry: false,
    placeholderData: (previousData) => previousData,
    staleTime: TRANSLATION_CACHE_TTL_MS,
    gcTime: TRANSLATION_CACHE_TTL_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [expiredRequestKey, setExpiredRequestKey] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      const resetTimeoutId = window.setTimeout(() => setExpiredRequestKey(null), 0);
      return () => window.clearTimeout(resetTimeoutId);
    }
    if (!query.isFetching) return;

    const timeoutId = window.setTimeout(
      () => setExpiredRequestKey(requestKey),
      Math.max(0, waitTimeoutMs),
    );
    return () => window.clearTimeout(timeoutId);
  }, [enabled, query.isFetching, requestKey, waitTimeoutMs]);

  const translations = query.data ?? EMPTY_TRANSLATIONS;
  const canShowLoading = enabled && query.isFetching && expiredRequestKey !== requestKey;
  const resolve = useCallback(
    (sourceText?: string | null): TranslationFieldView => {
      if (sourceText == null) return { text: null, status: 'source' };
      const normalizedText = normalizeTranslationText(sourceText);
      if (!enabled || !requestedTexts.has(normalizedText)) {
        return { text: sourceText, status: 'source' };
      }

      const translatedText = translations.get(normalizedText);
      if (translatedText) return { text: translatedText, status: 'translated' };
      return {
        text: sourceText,
        status: canShowLoading ? 'loading' : 'fallback',
      };
    },
    [canShowLoading, enabled, requestedTexts, translations],
  );

  return useMemo(
    () => ({
      resolve,
      isTranslating: canShowLoading,
      sourceLanguage,
      targetLanguage,
    }),
    [canShowLoading, resolve, sourceLanguage, targetLanguage],
  );
}
