import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { I18nextProvider } from 'react-i18next';

import { revalidateSession } from '../../features/auth';
import { i18n } from '../../shared/i18n';
import { AnalyticsProvider } from './AnalyticsProvider';
import { LocaleInitializer } from './LocaleInitializer';
import { ThemeInitializer } from './ThemeInitializer';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    void revalidateSession();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeInitializer />
        <LocaleInitializer />
        <AnalyticsProvider />
        {children}
      </QueryClientProvider>
    </I18nextProvider>
  );
}
