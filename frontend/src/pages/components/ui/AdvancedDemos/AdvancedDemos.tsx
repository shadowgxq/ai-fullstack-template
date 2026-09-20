import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enUS, zhCN } from 'react-day-picker/locale';
import { ShareDialog, type ShareContent } from '@/features/share';
import { useLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Calendar } from '@/shared/ui/calendar';
import { QueryComposer, type QueryComposerRemoteSearch } from '@/shared/ui/QueryComposer';
import { DemoSection } from '../DemoSection';

const OPTIONS = ['Button', 'Calendar', 'Dialog', 'Input', 'QueryComposer', 'ShareDialog'];
// Local fixture only; production callers supply a real search adapter and AbortSignal handling.
const DEMO_SEARCH: QueryComposerRemoteSearch<string> = {
  minChars: 1,
  debounceMs: 200,
  search: (query) => OPTIONS.filter((option) => option.toLowerCase().includes(query.toLowerCase())),
};

export function AdvancedDemos() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const content: ShareContent = {
    title: t('gallery.posterTitle'),
    slogan: t('gallery.posterSlogan'),
    result: t('gallery.posterResult'),
    fullText: t('gallery.posterResult'),
    landingUrl: 'https://example.com/demo',
  };
  return (
    <>
      <DemoSection title="Calendar">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          locale={locale === 'zh' ? zhCN : enUS}
        />
      </DemoSection>
      <DemoSection title="QueryComposer">
        <QueryComposer
          mode="hybrid"
          value={query}
          label={t('gallery.queryLabel')}
          description={t('gallery.queryDescription')}
          placeholder={t('gallery.queryPlaceholder')}
          onValueChange={setQuery}
          remoteSearch={DEMO_SEARCH}
          getItemKey={(item) => item}
          renderItem={(item) => item}
          onCommitItem={setCommittedQuery}
          onCommitQuery={setCommittedQuery}
          renderFreeform={(value) => t('gallery.useQuery', { query: value })}
          messages={{
            clearInput: t('gallery.clear'),
            suggestionsLabel: t('gallery.suggestions'),
            searching: t('gallery.searching'),
            empty: t('gallery.empty'),
            searchError: t('gallery.searchError'),
            retry: t('gallery.retry'),
          }}
        />
        <p role="status" className="break-words text-sm text-muted-foreground">
          {t('gallery.committed', { value: committedQuery || '—' })}
        </p>
      </DemoSection>
      <DemoSection title="ShareDialog">
        <p className="text-sm leading-6 text-muted-foreground">{t('gallery.shareDescription')}</p>
        <Button onClick={() => setShareOpen(true)}>{t('gallery.openShare')}</Button>
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          content={content}
          includeNativeShare
          poster={
            <article className="rounded-xl border border-border-subtle bg-card p-6 text-card-foreground">
              <p className="text-sm text-primary">{content.slogan}</p>
              <h3 className="mt-3 text-xl font-semibold">{content.title}</h3>
              <p className="mt-4 text-sm leading-6">{content.result}</p>
            </article>
          }
        />
      </DemoSection>
    </>
  );
}
