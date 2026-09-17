import { i18n } from '../i18n';

export type ApiLanguage = 'zh-CN' | 'en-US';

/** 将 UI locale 归一为 product-server 识别的语言标签。 */
export function toApiLanguage(locale: string | undefined): ApiLanguage {
  return locale?.trim().toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

export function getApiLanguage(): ApiLanguage {
  return toApiLanguage(i18n.resolvedLanguage ?? i18n.language);
}

/** 所有 API 请求都使用当前 UI 语言，让服务端错误和状态文案保持一致。 */
export function getApiLanguageHeaders(): Record<string, string> {
  const language = getApiLanguage();
  return {
    'X-Lang': language,
    'Accept-Language': language,
  };
}

export function selectApiLanguageText(
  language: ApiLanguage,
  zh: string | null | undefined,
  en: string | null | undefined,
  fallback?: string | null,
): string | undefined {
  const candidates = language === 'en-US' ? [en, zh, fallback] : [zh, en, fallback];
  return candidates.find((value): value is string => Boolean(value?.trim()))?.trim();
}
