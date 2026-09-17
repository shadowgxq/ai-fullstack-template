import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/** 把文档标题和根语言同步到当前 locale（index.html 中的静态值仅覆盖首帧）。 */
export function DocumentTitleSync() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = i18n.language;
  }, [t, i18n.language]);

  return null;
}
