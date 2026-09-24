import { createElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid2X2, Layers3, LayoutGrid, List, Package, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppShell } from '../../widgets/app-shell';
import { Input } from '@/shared/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  catalogCategories,
  componentCatalog,
  getCatalogIcon,
  type CatalogFilter,
} from './componentCatalog';

const categoryFilters: readonly CatalogFilter[] = ['all', ...catalogCategories];

const summaryStats = [
  { key: 'all', labelKey: 'components.summary.stats.total', Icon: Package },
  { key: 'shared', labelKey: 'components.summary.stats.shared', Icon: LayoutGrid },
  { key: 'advanced', labelKey: 'components.summary.stats.advanced', Icon: Layers3 },
] as const;

export function ComponentsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return componentCatalog.filter((item) => {
      const matchesFilter = filter === 'all' || item.category === filter;
      const searchableText = `${item.name} ${t(item.descriptionKey)} ${t(
        `components.catalog.categories.${item.category}.label`,
      )}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, query, t]);

  return (
    <AppShell>
      <div className="bg-page relative isolate min-h-full overflow-hidden">
        <div
          className="from-primary/8 pointer-events-none absolute inset-x-0 top-[-22rem] mx-auto h-[38rem] w-[min(100%,90rem)] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-from),transparent_68%)] blur-3xl dark:opacity-35"
          aria-hidden="true"
        />
        <main
          id="main-content"
          className="relative z-10 mx-auto w-[min(100%-2rem,1336px)] py-11 max-[760px]:py-8 max-[480px]:w-[min(100%-1.5rem,1336px)]"
          tabIndex={-1}
        >
          <header className="flex items-start justify-between gap-12 max-[980px]:gap-8 max-[760px]:flex-col">
            <div className="min-w-0 max-w-3xl pt-1">
              <h1 className="text-foreground text-[clamp(2.5rem,4.2vw,3.35rem)] leading-none font-bold tracking-[-0.055em]">
                {t('components.title')}
              </h1>
              <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed sm:text-lg">
                {t('components.description')}
              </p>
            </div>

            <div
              className="grid shrink-0 grid-cols-3 gap-4 max-[980px]:gap-3 max-[760px]:w-full max-[560px]:grid-cols-2"
              aria-label={t('components.summary.title')}
            >
              {summaryStats.map(({ key, labelKey, Icon }) => (
                <Stat
                  key={key}
                  value={String(
                    key === 'all'
                      ? componentCatalog.length
                      : t(`components.catalog.categories.${key}.count`),
                  )}
                  label={t(labelKey)}
                  Icon={Icon}
                />
              ))}
            </div>
          </header>

          <section
            className="border-border/70 bg-surface mt-10 rounded-2xl border p-3 shadow-sm sm:p-3.5"
            aria-labelledby="component-catalog-title"
          >
            <h2 id="component-catalog-title" className="sr-only">
              {t('components.catalog.title')}
            </h2>

            <div className="relative">
              <label htmlFor="component-catalog-search" className="sr-only">
                {t('components.catalog.searchLabel')}
              </label>
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
                size={19}
                aria-hidden="true"
              />
              <Input
                id="component-catalog-search"
                value={query}
                placeholder={t('components.catalog.searchPlaceholder')}
                className="h-12 rounded-xl border-border/80 bg-background pl-11 text-sm shadow-none placeholder:text-muted-foreground/75 sm:text-base"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <Tabs value={filter} onValueChange={(value) => setFilter(value as CatalogFilter)}>
                <TabsList
                  aria-label={t('components.catalog.filterLabel')}
                  className="h-11 gap-1 overflow-x-auto rounded-xl bg-muted/45 p-1 max-[520px]:w-full"
                >
                  {categoryFilters.map((category) => (
                    <TabsTrigger
                      key={category}
                      value={category}
                      className="text-muted-foreground hover:text-foreground h-9 rounded-lg px-4 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:px-5"
                    >
                      {category === 'all'
                        ? t('components.catalog.all')
                        : t(`components.catalog.categories.${category}.label`)}
                      <span className="text-[11px] opacity-60">
                        {category === 'all'
                          ? componentCatalog.length
                          : t(`components.catalog.categories.${category}.count`)}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div
                className="border-border/60 bg-muted/35 flex items-center gap-1 rounded-xl border p-1"
                aria-label={t('components.catalog.viewLabel')}
              >
                <button
                  type="button"
                  aria-label={t('components.catalog.gridView')}
                  aria-pressed={viewMode === 'grid'}
                  className="text-muted-foreground inline-grid size-9 place-items-center rounded-lg transition-colors hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-primary"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid2X2 size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('components.catalog.listView')}
                  aria-pressed={viewMode === 'list'}
                  className="text-muted-foreground inline-grid size-9 place-items-center rounded-lg transition-colors hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-primary"
                  onClick={() => setViewMode('list')}
                >
                  <List size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="sr-only" aria-live="polite">
              {t('components.catalog.resultCount', {
                shown: visibleItems.length,
                total: componentCatalog.length,
              })}
            </p>

            <section className="mt-5" aria-label={t('components.catalog.title')}>
              {visibleItems.length > 0 ? (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
                      : 'grid grid-cols-1 gap-3'
                  }
                >
                  {visibleItems.map((item) => (
                    <Link
                      key={item.slug}
                      to={`/components/${item.slug}`}
                      className="border-border/75 bg-card hover:border-primary/55 hover:bg-secondary/25 group flex min-h-[116px] items-center rounded-xl border p-4 no-underline shadow-sm transition-[border-color,background-color,box-shadow] duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:p-5"
                    >
                      <CardContent item={item} t={t} viewMode={viewMode} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="border-border/70 bg-muted/25 text-muted-foreground rounded-xl border border-dashed px-6 py-14 text-center text-sm">
                  {t('components.catalog.empty')}
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
    </AppShell>
  );
}

function Stat({ value, label, Icon }: { value: string; label: string; Icon: LucideIcon }) {
  return (
    <div className="border-border/70 bg-card flex min-w-[128px] items-center gap-3 rounded-xl border px-3 py-3 shadow-sm max-[980px]:min-w-0 max-[560px]:min-w-0">
      <span className="bg-secondary/70 text-primary inline-grid size-10 shrink-0 place-items-center rounded-xl">
        <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <strong className="text-foreground block text-lg leading-none font-bold tracking-[-0.03em]">
          {value}
        </strong>
        <span className="text-muted-foreground mt-1 block truncate text-xs">{label}</span>
      </span>
    </div>
  );
}

function CardContent({
  item,
  t,
  viewMode,
}: {
  item: (typeof componentCatalog)[number];
  t: (key: string) => string;
  viewMode: 'grid' | 'list';
}) {
  return (
    <div
      className={
        viewMode === 'list' ? 'flex w-full items-center gap-4' : 'flex w-full items-center gap-4'
      }
    >
      <span className="bg-secondary/65 text-primary inline-grid size-14 shrink-0 place-items-center rounded-xl">
        {createElement(getCatalogIcon(item.slug), {
          size: 25,
          strokeWidth: 2.1,
          'aria-hidden': true,
        })}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-foreground truncate text-base font-bold tracking-[-0.02em]">
            {item.name}
          </h3>
          <span className="bg-secondary/65 text-primary inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
            <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
            {t('components.catalog.ready')}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 truncate text-sm leading-relaxed">
          {t(item.descriptionKey)}
        </p>
      </div>
    </div>
  );
}
