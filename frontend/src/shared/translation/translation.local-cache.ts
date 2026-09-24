import {
  TRANSLATION_CACHE_SCHEMA_VERSION,
  TRANSLATION_CACHE_STORAGE_KEY,
  TRANSLATION_CACHE_TTL_MS,
  type TranslationCacheEntry,
  type TranslationLanguage,
} from './translation.types';

type StoredTranslationCache = {
  version: typeof TRANSLATION_CACHE_SCHEMA_VERSION;
  entries: Record<string, TranslationCacheEntry>;
};

let storageSnapshot: StoredTranslationCache | undefined;
let storageUnavailable = false;
let memoryFallbackEntries = new Map<string, TranslationCacheEntry>();
const keyCache = new Map<string, Promise<string>>();

export function normalizeTranslationText(value: string): string {
  return value.normalize('NFC').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function fallbackHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function digestText(value: string): Promise<string> {
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new globalThis.TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }
  return fallbackHash(value);
}

export function getTranslationCacheKey(
  value: string,
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
): Promise<string> {
  const normalizedValue = normalizeTranslationText(value);
  const memoKey = `${sourceLanguage}:${targetLanguage}:${normalizedValue}`;
  const cachedKey = keyCache.get(memoKey);
  if (cachedKey) return cachedKey;

  const keyPromise = digestText(normalizedValue).then(
    (digest) => `${TRANSLATION_CACHE_SCHEMA_VERSION}:${sourceLanguage}:${targetLanguage}:${digest}`,
  );
  keyCache.set(memoKey, keyPromise);
  return keyPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCacheEntry(value: unknown): value is TranslationCacheEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.translatedText === 'string' &&
    value.translatedText.trim().length > 0 &&
    typeof value.cachedAt === 'number' &&
    Number.isFinite(value.cachedAt) &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}

function emptyCache(): StoredTranslationCache {
  return { version: TRANSLATION_CACHE_SCHEMA_VERSION, entries: {} };
}

function storage(): Storage | null {
  if (storageUnavailable || typeof localStorage === 'undefined') return null;
  try {
    return localStorage;
  } catch {
    storageUnavailable = true;
    return null;
  }
}

function memoryCache(): StoredTranslationCache {
  return {
    version: TRANSLATION_CACHE_SCHEMA_VERSION,
    entries: Object.fromEntries(memoryFallbackEntries),
  };
}

function readCache(): StoredTranslationCache {
  if (storageUnavailable) return memoryCache();
  if (storageSnapshot) return storageSnapshot;

  const currentStorage = storage();
  if (!currentStorage) return memoryCache();

  try {
    const raw = currentStorage.getItem(TRANSLATION_CACHE_STORAGE_KEY);
    if (!raw) {
      storageSnapshot = emptyCache();
      return storageSnapshot;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== TRANSLATION_CACHE_SCHEMA_VERSION) {
      currentStorage.removeItem(TRANSLATION_CACHE_STORAGE_KEY);
      storageSnapshot = emptyCache();
      return storageSnapshot;
    }

    const entries: Record<string, TranslationCacheEntry> = {};
    if (isRecord(parsed.entries)) {
      Object.entries(parsed.entries).forEach(([key, value]) => {
        if (isCacheEntry(value)) entries[key] = value;
      });
    }
    storageSnapshot = { version: TRANSLATION_CACHE_SCHEMA_VERSION, entries };
    return storageSnapshot;
  } catch {
    try {
      currentStorage.removeItem(TRANSLATION_CACHE_STORAGE_KEY);
      storageSnapshot = emptyCache();
      return storageSnapshot;
    } catch {
      storageUnavailable = true;
      memoryFallbackEntries = new Map();
      return memoryCache();
    }
  }
}

function persistCache(cache: StoredTranslationCache): void {
  const currentStorage = storage();
  if (!currentStorage) {
    memoryFallbackEntries = new Map(Object.entries(cache.entries));
    return;
  }

  try {
    currentStorage.setItem(TRANSLATION_CACHE_STORAGE_KEY, JSON.stringify(cache));
    storageSnapshot = cache;
  } catch {
    storageUnavailable = true;
    memoryFallbackEntries = new Map(Object.entries(cache.entries));
  }
}

function removeExpiredEntries(cache: StoredTranslationCache, now: number): boolean {
  let changed = false;
  Object.entries(cache.entries).forEach(([key, entry]) => {
    if (entry.expiresAt <= now) {
      delete cache.entries[key];
      changed = true;
    }
  });
  return changed;
}

function uniqueNormalizedTexts(texts: readonly string[]): string[] {
  return [...new Set(texts.map(normalizeTranslationText).filter(Boolean))];
}

export async function getCachedTranslations(
  texts: readonly string[],
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
  now = Date.now(),
): Promise<Map<string, string>> {
  const normalizedTexts = uniqueNormalizedTexts(texts);
  if (normalizedTexts.length === 0) return new Map();

  const cache = readCache();
  if (removeExpiredEntries(cache, now)) persistCache(cache);
  const keys = await Promise.all(
    normalizedTexts.map((text) => getTranslationCacheKey(text, sourceLanguage, targetLanguage)),
  );
  const translations = new Map<string, string>();
  normalizedTexts.forEach((text, index) => {
    const entry = cache.entries[keys[index]];
    if (entry && entry.expiresAt > now) translations.set(text, entry.translatedText);
  });
  return translations;
}

export async function saveCachedTranslations(
  translations: ReadonlyMap<string, string>,
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
  now = Date.now(),
): Promise<void> {
  const validTranslations = [...translations.entries()]
    .map(
      ([text, translatedText]) => [normalizeTranslationText(text), translatedText.trim()] as const,
    )
    .filter(([text, translatedText]) => Boolean(text && translatedText));
  if (validTranslations.length === 0) return;

  const cache = readCache();
  removeExpiredEntries(cache, now);
  const keys = await Promise.all(
    validTranslations.map(([text]) => getTranslationCacheKey(text, sourceLanguage, targetLanguage)),
  );
  validTranslations.forEach(([, translatedText], index) => {
    cache.entries[keys[index]] = {
      translatedText,
      cachedAt: now,
      expiresAt: now + TRANSLATION_CACHE_TTL_MS,
    };
  });
  persistCache(cache);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TRANSLATION_CACHE_STORAGE_KEY) return;
    storageSnapshot = undefined;
    storageUnavailable = false;
  });
}

/** @internal Test-only reset for module-level cache state. */
export function resetTranslationCacheForTests(): void {
  storageSnapshot = undefined;
  storageUnavailable = false;
  memoryFallbackEntries = new Map();
  keyCache.clear();
}
