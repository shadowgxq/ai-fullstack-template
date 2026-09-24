import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '../../shared/i18n';

/** Keep the browser tab, description, and document language aligned with the active locale. */
export function LocaleInitializer() {
  const { t } = useTranslation();
  const { locale } = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = t('meta.title');
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', t('meta.description'));
  }, [locale, t]);

  return null;
}
