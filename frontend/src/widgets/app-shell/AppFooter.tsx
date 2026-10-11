import { useTranslation } from 'react-i18next';

/** 全局免责声明只放在 AppShell，业务页面不再各自复制一份 footer。 */
export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="text-muted-foreground bg-background shrink-0" data-app-footer>
      <div className="mx-auto flex min-h-12 w-[min(100%-2rem,var(--layout-max-width))] items-center justify-center px-1 py-3 text-center text-xs sm:px-2">
        <p className="max-w-[70ch] leading-relaxed">{t('app.footer.disclaimer')}</p>
      </div>
    </footer>
  );
}
