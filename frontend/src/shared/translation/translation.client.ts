import axios from 'axios';

import { createRequest } from '../api';
import { runtimeConfig } from '../config';
import {
  getCachedTranslations,
  getTranslationCacheKey,
  normalizeTranslationText,
  saveCachedTranslations,
} from './translation.local-cache';
import {
  MAX_TRANSLATION_BATCH_BYTES,
  MAX_TRANSLATION_ITEMS,
  MAX_TRANSLATION_TEXT_CHARS,
  type TranslationLanguage,
  type TranslationMap,
  type TranslationRequest,
  type TranslationRequestItem,
  type TranslationResponse,
} from './translation.types';

const translationHttpClient = axios.create({
  baseURL: runtimeConfig.translation.baseUrl,
  timeout: runtimeConfig.translation.timeoutMs,
});

// Translation uses a separate service credential injected by the reverse proxy.
// Never attach the product API's user Bearer token to this client.
const translationRequest = createRequest(translationHttpClient);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTranslationResponse(value: unknown): value is TranslationResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;
  return value.items.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.translated_text === 'string' &&
      item.translated_text.trim().length > 0,
  );
}

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).byteLength;
  } catch {
    return value.length;
  }
}

function splitBatches(texts: readonly string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;

  texts.forEach((text) => {
    const textBytes = byteLength(text);
    const reachesItemLimit = current.length >= MAX_TRANSLATION_ITEMS;
    const reachesByteLimit =
      current.length > 0 && currentBytes + textBytes > MAX_TRANSLATION_BATCH_BYTES;
    if (reachesItemLimit || reachesByteLimit) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(text);
    currentBytes += textBytes;
  });

  if (current.length > 0) batches.push(current);
  return batches;
}

async function toTranslationItems(
  texts: readonly string[],
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
): Promise<TranslationRequestItem[]> {
  return Promise.all(
    texts.map(async (text) => ({
      id: `text-${(await getTranslationCacheKey(text, sourceLanguage, targetLanguage)).split(':').at(-1)}`,
      text,
    })),
  );
}

async function requestTranslationBatch(
  texts: readonly string[],
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
  signal?: AbortSignal,
): Promise<TranslationMap> {
  const items = await toTranslationItems(texts, sourceLanguage, targetLanguage);
  const payload: TranslationRequest = {
    source_lang: sourceLanguage,
    target_lang: targetLanguage,
    items,
  };
  const response = await translationRequest<TranslationResponse, TranslationRequest>({
    method: 'POST',
    url: '/v1/translations',
    data: payload,
    signal,
  });
  if (!isTranslationResponse(response)) {
    throw new Error('Translation service returned an invalid response.');
  }

  const textById = new Map(items.map((item) => [item.id, item.text]));
  const translations = new Map<string, string>();
  response.items.forEach((item) => {
    const sourceText = textById.get(item.id);
    const translatedText = item.translated_text.trim();
    if (sourceText && translatedText) translations.set(sourceText, translatedText);
  });
  return translations;
}

export const translationApi = {
  requestBatch: requestTranslationBatch,
};

export async function translateTexts({
  texts,
  sourceLanguage,
  targetLanguage,
  signal,
}: Readonly<{
  texts: readonly string[];
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  signal?: AbortSignal;
}>): Promise<TranslationMap> {
  const normalizedTexts = [
    ...new Set(texts.map(normalizeTranslationText).filter((text) => text.length > 0)),
  ];
  if (normalizedTexts.length === 0 || sourceLanguage === targetLanguage) return new Map();

  const cacheableTexts = normalizedTexts.filter(
    (text) => text.length <= MAX_TRANSLATION_TEXT_CHARS,
  );
  const translations = await getCachedTranslations(cacheableTexts, sourceLanguage, targetLanguage);
  const missingTexts = cacheableTexts.filter((text) => !translations.has(text));
  if (missingTexts.length === 0) return translations;

  const results = await Promise.allSettled(
    splitBatches(missingTexts).map((batch) =>
      translationApi.requestBatch(batch, sourceLanguage, targetLanguage, signal),
    ),
  );
  if (signal?.aborted) throw new DOMException('Translation request aborted.', 'AbortError');

  const freshTranslations = new Map<string, string>();
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((translatedText, sourceText) => {
      translations.set(sourceText, translatedText);
      freshTranslations.set(sourceText, translatedText);
    });
  });
  if (freshTranslations.size > 0) {
    await saveCachedTranslations(freshTranslations, sourceLanguage, targetLanguage).catch(
      () => undefined,
    );
  }
  return translations;
}
