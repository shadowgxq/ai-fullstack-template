import { createElement, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Eye,
  Layers3,
  MoreHorizontal,
  Pencil,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { ShareDialog, type ShareContent } from '../../features/share';
import { AppShell } from '../../widgets/app-shell';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogSize,
  type DialogType,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { QueryComposer } from '@/shared/ui/QueryComposer';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/shared/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { Calendar } from '@/shared/ui/calendar';
import { cn } from '@/shared/utils/cn';
import {
  catalogCategories,
  componentCatalog,
  getCatalogIcon,
  getCatalogItem,
  type ComponentCatalogItem,
} from './componentCatalog';

type DetailTab = 'preview' | 'examples' | 'api';

type ApiRow = Readonly<{
  name: string;
  type: string;
  defaultValue: string;
  descriptionKey: string;
}>;

const detailTabs: readonly { value: DetailTab; labelKey: string }[] = [
  { value: 'preview', labelKey: 'components.detail.tabs.preview' },
  { value: 'examples', labelKey: 'components.detail.tabs.examples' },
  { value: 'api', labelKey: 'components.detail.tabs.api' },
];

const buttonApiRows: readonly ApiRow[] = [
  {
    name: 'variant',
    type: "'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'",
    defaultValue: "'default'",
    descriptionKey: 'components.detail.api.button.variant',
  },
  {
    name: 'size',
    type: "'default' | 'xs' | 'sm' | 'lg' | 'icon'",
    defaultValue: "'default'",
    descriptionKey: 'components.detail.api.button.size',
  },
  {
    name: 'disabled',
    type: 'boolean',
    defaultValue: 'false',
    descriptionKey: 'components.detail.api.button.disabled',
  },
  {
    name: 'asChild',
    type: 'boolean',
    defaultValue: 'false',
    descriptionKey: 'components.detail.api.button.asChild',
  },
];

const skeletonApiRows: readonly ApiRow[] = [
  {
    name: 'className',
    type: 'string',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.skeleton.className',
  },
  {
    name: 'aria-hidden',
    type: 'boolean | "true" | "false"',
    defaultValue: 'true',
    descriptionKey: 'components.detail.api.skeleton.ariaHidden',
  },
];

const dialogApiRows: readonly ApiRow[] = [
  {
    name: 'type',
    type: "'default' | 'warning' | 'danger'",
    defaultValue: "'default'",
    descriptionKey: 'components.detail.api.dialog.type',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    defaultValue: "'md'",
    descriptionKey: 'components.detail.api.dialog.size',
  },
  {
    name: 'variant',
    type: "'default' | 'flush'",
    defaultValue: "'default'",
    descriptionKey: 'components.detail.api.dialog.variant',
  },
  {
    name: 'showCloseButton',
    type: 'boolean',
    defaultValue: 'true',
    descriptionKey: 'components.detail.api.dialog.showCloseButton',
  },
  {
    name: 'closeLabel',
    type: 'string',
    defaultValue: "'Close'",
    descriptionKey: 'components.detail.api.dialog.closeLabel',
  },
];

const apiRowsBySlug: Record<string, readonly ApiRow[]> = {
  button: buttonApiRows,
  dialog: dialogApiRows,
  skeleton: skeletonApiRows,
};

type QueryPreviewItem = Readonly<{
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto' | 'commodity';
}>;

const queryPreviewItems: readonly QueryPreviewItem[] = [
  { id: 'apple', symbol: 'AAPL', name: 'Apple', type: 'stock' },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { id: 'gold', symbol: 'XAU', name: 'Gold', type: 'commodity' },
];

const tooltipPreviewPositions = [
  { side: 'top', labelKey: 'components.detail.preview.tooltip.top' },
  { side: 'bottom', labelKey: 'components.detail.preview.tooltip.bottom' },
  { side: 'right', labelKey: 'components.detail.preview.tooltip.right' },
] as const;

const switchPreviewStates = [
  { key: 'unchecked', checked: false, disabled: false },
  { key: 'checked', checked: true, disabled: false },
  { key: 'disabledOff', checked: false, disabled: true },
  { key: 'disabledOn', checked: true, disabled: true },
] as const;

const dialogExampleTypes = [
  'default',
  'warning',
  'danger',
] as const satisfies readonly DialogType[];

const dialogSizeOptions = [
  { value: 'sm', labelKey: 'components.detail.preview.dialog.sizes.small' },
  { value: 'md', labelKey: 'components.detail.preview.dialog.sizes.medium' },
  { value: 'lg', labelKey: 'components.detail.preview.dialog.sizes.large' },
] as const satisfies readonly { value: DialogSize; labelKey: string }[];

const dialogActionClassNames: Record<DialogType, string> = {
  default: '',
  warning:
    'bg-warning text-warning-foreground hover:bg-warning/90 active:bg-warning/80 focus-visible:ring-warning',
  danger:
    'bg-destructive text-primary-foreground hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive',
};

export function ComponentDetailPage() {
  const { componentName } = useParams<{ componentName: string }>();
  const item = getCatalogItem(componentName);

  if (!item) {
    return <Navigate to="/components" replace />;
  }

  return <ComponentDetail key={item.slug} item={item} />;
}

function ComponentDetail({ item }: { item: ComponentCatalogItem }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DetailTab>('preview');
  const [copiedValue, setCopiedValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('one');
  const [switchValue, setSwitchValue] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2026, 8, 8));

  const exampleCode = createUsageCode(item, t);
  const apiRows = apiRowsBySlug[item.slug] ?? [
    {
      name: 'children',
      type: 'ReactNode',
      defaultValue: '—',
      descriptionKey: 'components.detail.api.generic.children',
    },
    {
      name: 'className',
      type: 'string',
      defaultValue: '—',
      descriptionKey: 'components.detail.api.generic.className',
    },
  ];

  const copyValue = (value: string) => {
    if (!navigator.clipboard) return;

    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopiedValue(value);
        window.setTimeout(() => setCopiedValue(''), 1600);
      })
      .catch(() => undefined);
  };

  return (
    <AppShell>
      <div className="bg-page relative isolate min-h-full overflow-hidden">
        <div
          className="from-primary/8 pointer-events-none absolute inset-x-0 top-[-20rem] mx-auto h-[34rem] w-[min(100%,90rem)] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-from),transparent_70%)] blur-3xl dark:opacity-30"
          aria-hidden="true"
        />
        <main
          id="main-content"
          className="relative z-10 mx-auto grid min-h-[calc(100dvh-60px)] w-[min(100%-2rem,1408px)] grid-cols-[280px_minmax(0,1fr)] gap-0 py-3 max-[900px]:block max-[760px]:w-[min(100%-1.5rem,1408px)]"
          tabIndex={-1}
        >
          <ComponentSidebar item={item} />

          <article className="min-w-0 py-1 pl-8 pr-0 max-[900px]:px-0 max-[900px]:pt-7">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <Link
                to="/components"
                className="text-muted-foreground hover:text-foreground rounded-sm no-underline transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                {t('components.title')}
              </Link>
              <span className="text-muted-foreground/45" aria-hidden="true">
                /
              </span>
              <span className="text-muted-foreground">
                {t(`components.catalog.categories.${item.category}.label`)}
              </span>
              <span className="text-muted-foreground/45" aria-hidden="true">
                /
              </span>
              <span className="text-foreground font-medium">{item.name}</span>
            </div>

            <header className="mt-5 flex items-start justify-between gap-8 max-[620px]:flex-col">
              <div className="min-w-0">
                <h1 className="text-foreground text-[var(--text-page-title-size)] leading-[var(--text-page-title-line)] font-bold tracking-[-0.045em]">
                  {item.name}
                </h1>
                <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
                  {t(item.descriptionKey)}
                </p>
              </div>
              <span className="bg-secondary/70 text-primary inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold">
                <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
                {t('components.detail.ready')}
              </span>
            </header>

            <Tabs
              id="component-tabs"
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as DetailTab)}
              className="mt-5"
            >
              <TabsList className="h-auto w-full justify-start gap-7 overflow-x-auto rounded-none border-b border-border/70 bg-transparent p-0 max-[520px]:gap-5">
                {detailTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-muted-foreground hover:text-foreground h-10 rounded-none border-b-2 border-transparent px-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    {t(tab.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="preview" className="mt-5">
                <ComponentPreview
                  item={item}
                  t={t}
                  inputValue={inputValue}
                  selectValue={selectValue}
                  switchValue={switchValue}
                  selectedDate={selectedDate}
                  exampleCode={exampleCode}
                  copiedValue={copiedValue}
                  onCopy={copyValue}
                  onInputChange={setInputValue}
                  onSelectChange={setSelectValue}
                  onSwitchChange={setSwitchValue}
                  onDateChange={setSelectedDate}
                />
              </TabsContent>

              <TabsContent value="examples" className="mt-7 space-y-6">
                <DetailIntro
                  eyebrow={t('components.detail.examples.eyebrow')}
                  title={t('components.detail.examples.title')}
                  description={t('components.detail.examples.description')}
                />
                <CodeBlock
                  title={t('components.detail.code.exampleTitle')}
                  code={exampleCode}
                  copied={copiedValue === exampleCode}
                  onCopy={() => copyValue(exampleCode)}
                  copyLabel={t('components.detail.copyCode')}
                  copiedLabel={t('components.detail.copied')}
                />
              </TabsContent>

              <TabsContent value="api" className="mt-7">
                <DetailIntro
                  eyebrow={t('components.detail.api.eyebrow')}
                  title={t('components.detail.api.title')}
                  description={t('components.detail.api.description')}
                />
                <ApiTable rows={apiRows} t={t} />
              </TabsContent>
            </Tabs>

            <section id="source" className="border-border mt-10 border-t pt-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-primary font-sans text-xs tracking-[0.12em] uppercase">
                    {t('components.detail.source.eyebrow')}
                  </p>
                  <h2 className="text-foreground mt-2 text-lg font-semibold">
                    {t('components.detail.source.title')}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyValue(item.sourcePath)}
                  >
                    {copiedValue === item.sourcePath ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                    {copiedValue === item.sourcePath
                      ? t('components.detail.copied')
                      : t('components.detail.source.copyPath')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveTab('examples');
                      document.getElementById('component-tabs')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }}
                  >
                    {t('components.detail.source.viewCode')}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <code className="border-border/70 bg-muted/35 text-muted-foreground mt-5 block overflow-x-auto rounded-lg border px-4 py-3 font-mono text-xs">
                {item.sourcePath}
              </code>
            </section>
          </article>
        </main>
      </div>
    </AppShell>
  );
}

function ComponentSidebar({ item }: { item: ComponentCatalogItem }) {
  const { t } = useTranslation();

  return (
    <aside
      className="border-border/70 min-h-[calc(100dvh-60px)] border-r pr-5 lg:sticky lg:top-[76px] lg:max-h-[calc(100dvh-88px)] lg:self-start lg:overflow-y-auto max-[900px]:min-h-0 max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:pb-5 max-[900px]:pr-0"
      aria-label={t('components.detail.sidebarLabel')}
    >
      <div className="relative mb-5">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          size={16}
          aria-hidden="true"
        />
        <Input
          aria-label={t('components.detail.sidebarSearch')}
          placeholder={t('components.detail.sidebarSearch')}
          className="h-11 rounded-lg bg-background pl-9 text-[15px] shadow-none"
        />
      </div>

      <nav className="grid gap-6 max-[900px]:flex max-[900px]:gap-8 max-[900px]:overflow-x-auto max-[900px]:pb-2">
        {catalogCategories.map((category) => {
          const categoryItems = componentCatalog.filter(
            (candidate) => candidate.category === category,
          );

          return (
            <div key={category} className="min-w-[248px]">
              <h2 className="text-foreground mb-2 px-4 text-[15px] font-bold">
                {t(`components.catalog.categories.${category}.label`)}
              </h2>
              <div className="grid gap-0.5">
                {categoryItems.map((candidate) => {
                  const isActive = candidate.slug === item.slug;

                  return (
                    <Link
                      key={candidate.slug}
                      to={`/components/${candidate.slug}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-10 items-center gap-3 rounded-lg px-4 text-[15px] no-underline transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        isActive && 'bg-secondary text-primary font-semibold',
                      )}
                    >
                      {createElement(getCatalogIcon(candidate.slug), {
                        size: 17,
                        strokeWidth: 2,
                        'aria-hidden': true,
                      })}
                      {candidate.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function ComponentPreview({
  item,
  t,
  inputValue,
  selectValue,
  switchValue,
  selectedDate,
  exampleCode,
  copiedValue,
  onCopy,
  onInputChange,
  onSelectChange,
  onSwitchChange,
  onDateChange,
}: {
  item: ComponentCatalogItem;
  t: (key: string, options?: Record<string, unknown>) => string;
  inputValue: string;
  selectValue: string;
  switchValue: boolean;
  selectedDate: Date | undefined;
  exampleCode: string;
  copiedValue: string;
  onCopy: (value: string) => void;
  onInputChange: (value: string) => void;
  onSelectChange: (value: string) => void;
  onSwitchChange: (value: boolean) => void;
  onDateChange: (value: Date | undefined) => void;
}) {
  if (item.slug === 'button') {
    return (
      <ButtonPreview
        item={item}
        t={t}
        exampleCode={exampleCode}
        copiedValue={copiedValue}
        onCopy={onCopy}
      />
    );
  }

  if (item.slug === 'input') {
    return <InputPreview t={t} value={inputValue} onChange={onInputChange} />;
  }

  if (item.slug === 'textarea') {
    return <TextareaPreview t={t} />;
  }

  if (item.slug === 'skeleton') {
    return <SkeletonPreview t={t} />;
  }

  if (item.slug === 'label') {
    return <LabelPreview t={t} />;
  }

  if (item.slug === 'select') {
    return <SelectPreview t={t} value={selectValue} onChange={onSelectChange} />;
  }

  if (item.slug === 'tabs') {
    return <TabsPreview t={t} />;
  }

  if (item.slug === 'dialog') {
    return <DialogPreview t={t} />;
  }

  if (item.slug === 'dropdown-menu') {
    return <DropdownPreview t={t} />;
  }

  if (item.slug === 'popover') {
    return <PopoverPreview t={t} />;
  }

  if (item.slug === 'tooltip') {
    return <TooltipPreview t={t} />;
  }

  if (item.slug === 'switch') {
    return <SwitchPreview t={t} checked={switchValue} onChange={onSwitchChange} />;
  }

  if (item.slug === 'calendar') {
    return <CalendarPreview t={t} selected={selectedDate} onSelect={onDateChange} />;
  }

  if (item.slug === 'query-composer') {
    return <QueryComposerPreview t={t} />;
  }

  if (item.slug === 'share-dialog') {
    return <ShareDialogPreview item={item} t={t} />;
  }

  return <GenericPreview item={item} t={t} />;
}

function ButtonPreview({
  item,
  t,
  exampleCode,
  copiedValue,
  onCopy,
}: {
  item: ComponentCatalogItem;
  t: (key: string, options?: Record<string, unknown>) => string;
  exampleCode: string;
  copiedValue: string;
  onCopy: (value: string) => void;
}) {
  const Icon = getCatalogIcon(item.slug);

  return (
    <div className="space-y-4">
      <section className="border-border/70 bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <header className="flex items-start gap-4 border-b border-border/70 pb-4">
          <span className="bg-secondary/65 text-primary inline-grid size-14 shrink-0 place-items-center rounded-xl">
            {createElement(Icon, {
              size: 25,
              strokeWidth: 2.1,
              'aria-hidden': true,
            })}
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-xl leading-7 font-bold tracking-[-0.03em]">
              {t('components.detail.preview.button.cardTitle')}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-5">
              {t('components.detail.preview.button.cardDescription')}
            </p>
          </div>
        </header>

        <div className="space-y-5 pt-5">
          <section aria-labelledby="button-styles-title">
            <h3
              id="button-styles-title"
              className="text-foreground text-base leading-5 font-semibold"
            >
              {t('components.detail.preview.button.basicTitle')}
            </h3>
            <div className="mt-3 grid grid-cols-4 gap-3 max-[640px]:grid-cols-2 max-[420px]:grid-cols-1">
              <Button className="w-full">{t('components.detail.preview.button.primary')}</Button>
              <Button variant="secondary" className="w-full">
                {t('components.detail.preview.button.secondary')}
              </Button>
              <Button variant="outline" className="w-full">
                {t('components.detail.preview.button.ghost')}
              </Button>
              <Button variant="destructive" className="w-full">
                {t('components.detail.preview.button.destructive')}
              </Button>
            </div>
          </section>

          <section aria-labelledby="button-states-title">
            <h3
              id="button-states-title"
              className="text-foreground text-base leading-5 font-semibold"
            >
              {t('components.detail.preview.button.statesTitle')}
            </h3>
            <div className="mt-3 grid max-w-[20rem] grid-cols-2 gap-3 max-[420px]:max-w-none max-[420px]:grid-cols-1">
              <Button variant="secondary" disabled className="w-full">
                {t('components.detail.preview.button.disabled')}
              </Button>
              <Button
                loading
                loadingLabel={t('components.detail.preview.button.loading')}
                className="w-full"
              >
                {t('components.detail.preview.button.loading')}
              </Button>
            </div>
          </section>

          <section aria-labelledby="button-sizes-title">
            <h3
              id="button-sizes-title"
              className="text-foreground text-base leading-5 font-semibold"
            >
              {t('components.detail.preview.button.sizesTitle')}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline">
                {t('components.detail.preview.button.small')}
              </Button>
              <Button>{t('components.detail.preview.button.defaultSize')}</Button>
              <Button size="lg">{t('components.detail.preview.button.large')}</Button>
            </div>
          </section>
        </div>
      </section>

      <CodeBlock
        title={t('components.detail.code.exampleTitle')}
        description={t('components.detail.code.exampleDescription')}
        code={exampleCode}
        copied={copiedValue === exampleCode}
        onCopy={() => onCopy(exampleCode)}
        copyLabel={t('components.detail.copyCode')}
        copiedLabel={t('components.detail.copied')}
        sourcePath={item.sourcePath}
        sourceLabel={t('components.detail.source.label')}
        sourceCopyLabel={t('components.detail.source.copyPath')}
        onCopySource={() => onCopy(item.sourcePath)}
      />
    </div>
  );
}

function InputPreview({
  t,
  value,
  onChange,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.input.basicTitle')}>
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="component-detail-input">
              {t('components.detail.preview.input.label')}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="component-detail-input"
              value={value}
              placeholder={t('components.detail.preview.input.placeholder')}
              aria-describedby="component-detail-input-helper"
              onChange={(event) => onChange(event.target.value)}
            />
            <p id="component-detail-input-helper" className="text-muted-foreground text-xs">
              {t('components.detail.preview.input.helper')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-detail-input-focus">
              {t('components.detail.preview.input.focus')}
            </Label>
            <Input
              id="component-detail-input-focus"
              data-preview-state="focus"
              defaultValue={t('components.detail.preview.input.focusValue')}
              className="border-ring ring-[var(--control-focus-stroke)] ring-ring ring-offset-[var(--focus-ring-offset)]"
            />
            <p className="text-muted-foreground text-xs">
              {t('components.detail.preview.input.helper')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-detail-input-disabled">
              {t('components.detail.preview.input.disabled')}
            </Label>
            <Input
              id="component-detail-input-disabled"
              value={t('components.detail.preview.input.placeholder')}
              disabled
              readOnly
              aria-describedby="component-detail-input-disabled-helper"
            />
            <p
              id="component-detail-input-disabled-helper"
              className="text-muted-foreground text-xs"
            >
              {t('components.detail.preview.input.helper')}
            </p>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="component-detail-input-error">
              {t('components.detail.preview.input.error')}
            </Label>
            <Input
              id="component-detail-input-error"
              defaultValue="invalid@"
              aria-invalid="true"
              aria-describedby="component-detail-input-error-message"
            />
            <p
              id="component-detail-input-error-message"
              className="text-destructive text-xs"
              role="alert"
            >
              {t('components.detail.preview.input.errorMessage')}
            </p>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function TextareaPreview({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.textarea.basicTitle')}>
        <div className="grid max-w-lg gap-2">
          <Label htmlFor="component-detail-textarea">
            {t('components.detail.preview.textarea.label')}
          </Label>
          <Textarea
            id="component-detail-textarea"
            value={value}
            maxLength={500}
            placeholder={t('components.detail.preview.textarea.placeholder')}
            aria-describedby="component-detail-textarea-helper"
            onChange={(event) => setValue(event.target.value)}
          />
          <div
            id="component-detail-textarea-helper"
            className="text-muted-foreground flex items-center justify-between gap-3 text-xs"
          >
            <span>{t('components.detail.preview.textarea.helper')}</span>
            <span aria-live="polite">
              {t('components.detail.preview.textarea.counter', { count: value.length })}
            </span>
          </div>
        </div>
        <div className="mt-5 grid max-w-lg gap-2">
          <Label htmlFor="component-detail-textarea-focus">
            {t('components.detail.preview.textarea.focus')}
          </Label>
          <Textarea
            id="component-detail-textarea-focus"
            data-preview-state="focus"
            defaultValue={t('components.detail.preview.textarea.focusValue')}
            className="border-ring ring-[var(--control-focus-stroke)] ring-ring ring-offset-[var(--focus-ring-offset)]"
          />
          <p className="text-muted-foreground text-xs">
            {t('components.detail.preview.textarea.helper')}
          </p>
        </div>
        <div className="mt-5 grid max-w-lg gap-2">
          <Label htmlFor="component-detail-textarea-disabled">
            {t('components.detail.preview.textarea.disabled')}
          </Label>
          <Textarea
            id="component-detail-textarea-disabled"
            disabled
            defaultValue={t('components.detail.preview.textarea.disabledValue')}
          />
        </div>
        <div className="mt-5 grid max-w-lg gap-2">
          <Label htmlFor="component-detail-textarea-error">
            {t('components.detail.preview.textarea.error')}
          </Label>
          <Textarea
            id="component-detail-textarea-error"
            defaultValue=""
            aria-invalid="true"
            aria-describedby="component-detail-textarea-error-message"
            placeholder={t('components.detail.preview.textarea.placeholder')}
          />
          <p
            id="component-detail-textarea-error-message"
            className="text-destructive text-xs"
            role="alert"
          >
            {t('components.detail.preview.textarea.errorMessage')}
          </p>
        </div>
      </PreviewBlock>
    </div>
  );
}

function SkeletonPreview({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock
        title={t('components.detail.preview.skeleton.basicTitle')}
        description={t('components.detail.preview.skeleton.basicDescription')}
      >
        <div
          className="max-w-lg space-y-4"
          role="status"
          aria-busy="true"
          aria-label={t('components.detail.preview.skeleton.loadingLabel')}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
        </div>
      </PreviewBlock>
    </div>
  );
}

function QueryComposerPreview({
  t,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [value, setValue] = useState('');
  const [committed, setCommitted] = useState('');
  const messages = useMemo(
    () => ({
      clearInput: t('components.input.clearInput'),
      suggestionsLabel: t('components.input.suggestionsLabel'),
      searching: t('components.input.searching'),
      empty: t('components.input.empty'),
      searchError: t('components.input.searchError'),
      retry: t('components.input.retry'),
    }),
    [t],
  );
  const remoteSearch = useMemo(
    () => ({
      minChars: 1,
      debounceMs: 120,
      maxResults: 6,
      search: (query: string) => {
        const normalizedQuery = query.trim().toLowerCase();
        return queryPreviewItems.filter(
          (item) =>
            item.symbol.toLowerCase().includes(normalizedQuery) ||
            item.name.toLowerCase().includes(normalizedQuery),
        );
      },
    }),
    [],
  );

  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.input.eyebrow')}
        title={t('components.input.title')}
        description={t('components.input.description')}
      />
      <PreviewBlock title={t('components.input.contractTitle')}>
        <QueryComposer<QueryPreviewItem>
          mode="hybrid"
          value={value}
          label={t('components.input.label')}
          description={t('components.input.helper')}
          placeholder={t('components.input.placeholder')}
          messages={messages}
          remoteSearch={remoteSearch}
          getItemKey={(item) => item.id}
          renderItem={(item, state) => (
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-3',
                state.isDisabled && 'opacity-[var(--disabled-opacity)]',
              )}
            >
              <span
                className="bg-secondary text-secondary-foreground inline-grid size-8 shrink-0 place-items-center rounded-md font-mono text-xs font-semibold uppercase"
                aria-hidden="true"
              >
                {item.symbol.charAt(0)}
              </span>
              <span className="min-w-0">
                <strong className="text-foreground block truncate text-sm leading-5 font-semibold">
                  {item.symbol}
                </strong>
                <span className="text-muted-foreground block truncate text-xs leading-5">
                  {item.name} · {t(`components.input.candidateTypes.${item.type}`)}
                </span>
              </span>
            </span>
          )}
          renderFreeform={(query) => t('components.input.freeformValue', { value: query })}
          onValueChange={setValue}
          onCommitItem={(item) => setCommitted(`${item.symbol} · ${item.name}`)}
          onCommitQuery={setCommitted}
        />
        <p className="text-muted-foreground mt-4 text-sm" aria-live="polite">
          {committed
            ? t('components.input.committed', { value: committed })
            : t('components.input.commitEmpty')}
        </p>
      </PreviewBlock>
    </div>
  );
}

function LabelPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.label.basicTitle')}>
        <div className="grid max-w-lg gap-5">
          <div className="grid gap-2">
            <Label htmlFor="component-detail-label-input">
              {t('components.detail.preview.label.label')}
              <span className="text-muted-foreground text-xs font-normal">
                {t('components.detail.preview.label.required')}
              </span>
            </Label>
            <Input
              id="component-detail-label-input"
              placeholder={t('components.detail.preview.label.placeholder')}
              aria-describedby="component-detail-label-helper"
            />
            <p id="component-detail-label-helper" className="text-muted-foreground text-xs">
              {t('components.detail.preview.label.helper')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-detail-label-optional">
              {t('components.detail.preview.label.label')}
              <span className="text-muted-foreground text-xs font-normal">
                {t('components.detail.preview.label.optional')}
              </span>
            </Label>
            <Input
              id="component-detail-label-optional"
              placeholder={t('components.detail.preview.label.placeholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-detail-label-error">
              {t('components.detail.preview.label.label')}
            </Label>
            <Input
              id="component-detail-label-error"
              defaultValue="wrong-format"
              aria-invalid="true"
              aria-describedby="component-detail-label-error-message"
            />
            <p
              id="component-detail-label-error-message"
              className="text-destructive text-xs"
              role="alert"
            >
              {t('components.detail.preview.label.error')}
            </p>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function SelectPreview({
  t,
  value,
  onChange,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.select.basicTitle')}>
        <div className="grid max-w-4xl gap-5 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="component-detail-select">
              {t('components.detail.preview.select.label')}
            </Label>
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger id="component-detail-select">
                <SelectValue placeholder={t('components.detail.preview.select.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one">
                  {t('components.detail.preview.select.options.one')}
                </SelectItem>
                <SelectItem value="two">
                  {t('components.detail.preview.select.options.two')}
                </SelectItem>
                <SelectItem value="three">
                  {t('components.detail.preview.select.options.three')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-detail-select-open">
              {t('components.detail.preview.select.open')}
            </Label>
            <Select defaultOpen defaultValue="one">
              <SelectTrigger id="component-detail-select-open">
                <SelectValue placeholder={t('components.detail.preview.select.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one">
                  {t('components.detail.preview.select.options.one')}
                </SelectItem>
                <SelectItem value="two">
                  {t('components.detail.preview.select.options.two')}
                </SelectItem>
                <SelectItem value="three">
                  {t('components.detail.preview.select.options.three')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-detail-select-disabled">
              {t('components.detail.preview.select.disabled')}
            </Label>
            <Select disabled>
              <SelectTrigger id="component-detail-select-disabled">
                <SelectValue placeholder={t('components.detail.preview.select.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one">
                  {t('components.detail.preview.select.options.one')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function TabsPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.tabs.basicTitle')}>
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview">{t('components.detail.preview.tabs.preview')}</TabsTrigger>
            <TabsTrigger value="code">{t('components.detail.preview.tabs.code')}</TabsTrigger>
            <TabsTrigger value="features">
              {t('components.detail.preview.tabs.features')}
            </TabsTrigger>
            <TabsTrigger value="history">{t('components.detail.preview.tabs.history')}</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="text-muted-foreground text-sm">
            {t('components.detail.preview.tabs.previewContent')}
          </TabsContent>
          <TabsContent value="code" className="text-muted-foreground text-sm">
            {t('components.detail.preview.tabs.codeContent')}
          </TabsContent>
          <TabsContent value="features" className="text-muted-foreground text-sm">
            {t('components.detail.preview.tabs.featuresContent')}
          </TabsContent>
          <TabsContent value="history" className="text-muted-foreground text-sm">
            {t('components.detail.preview.tabs.historyContent')}
          </TabsContent>
        </Tabs>
      </PreviewBlock>
    </div>
  );
}

type DialogSelection = Readonly<{
  type: DialogType;
  size: DialogSize;
}>;

function DialogPreview({ t }: { t: (key: string) => string }) {
  const [activeDialog, setActiveDialog] = useState<DialogSelection | null>(null);
  const activeCopyKey = activeDialog
    ? `components.detail.preview.dialog.types.${activeDialog.type}`
    : 'components.detail.preview.dialog.types.default';
  const activeType = activeDialog?.type ?? 'default';

  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <div className="border-border/70 bg-card flex flex-wrap gap-3 rounded-xl border p-4 shadow-sm">
        {dialogExampleTypes.map((type) => {
          const copyKey = `components.detail.preview.dialog.types.${type}`;

          return (
            <Button
              key={type}
              type="button"
              size="sm"
              onClick={() => setActiveDialog({ type, size: 'sm' })}
            >
              {t(`${copyKey}.open`)}
            </Button>
          );
        })}
        {dialogSizeOptions.map(({ value, labelKey }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveDialog({ type: 'default', size: value })}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>

      <Dialog
        open={activeDialog !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
        <DialogContent
          type={activeType}
          size={activeDialog?.size ?? 'sm'}
          closeLabel={t('components.detail.preview.dialog.close')}
        >
          <DialogHeader className="pr-10">
            <DialogTitle>{t(`${activeCopyKey}.title`)}</DialogTitle>
            <DialogDescription>{t(`${activeCopyKey}.description`)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                {t(`${activeCopyKey}.cancel`)}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="button" size="sm" className={dialogActionClassNames[activeType]}>
                {t(`${activeCopyKey}.action`)}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DropdownPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.dropdown.basicTitle')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t('components.detail.preview.dropdown.open')}
              <ChevronDown size={15} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t('components.detail.preview.dropdown.group')}</DropdownMenuLabel>
            <DropdownMenuItem>
              <Eye aria-hidden="true" />
              {t('components.detail.preview.dropdown.first')}
              <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil aria-hidden="true" />
              {t('components.detail.preview.dropdown.edit')}
              <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy aria-hidden="true" />
              {t('components.detail.preview.dropdown.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2 aria-hidden="true" />
              {t('components.detail.preview.dropdown.delete')}
              <DropdownMenuShortcut>
                {t('components.detail.preview.dropdown.shortcut')}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PreviewBlock>
    </div>
  );
}

function PopoverPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.popover.basicTitle')}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t('components.detail.preview.popover.open')}</Button>
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverHeader>
              <PopoverTitle>{t('components.detail.preview.popover.title')}</PopoverTitle>
              <PopoverDescription>
                {t('components.detail.preview.popover.description')}
              </PopoverDescription>
            </PopoverHeader>
            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
              <PopoverClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('components.detail.preview.popover.close')}
                >
                  {t('components.detail.preview.popover.close')}
                </Button>
              </PopoverClose>
              <PopoverClose asChild>
                <Button type="button" size="sm">
                  {t('components.detail.preview.popover.action')}
                </Button>
              </PopoverClose>
            </div>
          </PopoverContent>
        </Popover>
      </PreviewBlock>
    </div>
  );
}

function TooltipPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.tooltip.basicTitle')}>
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-wrap items-center gap-10 px-4 py-8">
            {tooltipPreviewPositions.map(({ side, labelKey }) => (
              <div key={side} className="grid justify-items-center gap-2 pt-8">
                <Tooltip open>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal size={17} aria-hidden="true" />
                      {t(labelKey)}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={side}>
                    {t('components.detail.preview.tooltip.content')}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </TooltipProvider>
      </PreviewBlock>
    </div>
  );
}

function SwitchPreview({
  t,
  checked,
  onChange,
}: {
  t: (key: string) => string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.switch.basicTitle')}>
        <div className="grid max-w-3xl gap-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {switchPreviewStates.map(({ key, checked: stateChecked, disabled }) => (
              <div key={key} className="grid justify-items-start gap-2">
                <Switch
                  data-preview-state={key}
                  checked={stateChecked}
                  disabled={disabled}
                  aria-label={t(`components.detail.preview.switch.states.${key}`)}
                />
                <span className="text-muted-foreground text-xs">
                  {t(`components.detail.preview.switch.states.${key}`)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-border/70 bg-muted/25 flex items-center gap-3 rounded-lg border p-3">
            <Switch id="component-detail-switch" checked={checked} onCheckedChange={onChange} />
            <Label htmlFor="component-detail-switch">
              {t('components.detail.preview.switch.interactive')}
            </Label>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function CalendarPreview({
  t,
  selected,
  onSelect,
}: {
  t: (key: string) => string;
  selected: Date | undefined;
  onSelect: (value: Date | undefined) => void;
}) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.calendar.basicTitle')}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,220px)_minmax(0,var(--calendar-width))_minmax(0,1fr)]">
          <div className="grid gap-2">
            <span className="text-muted-foreground text-xs">
              {t('components.detail.preview.calendar.trigger')}
            </span>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              aria-label={t('components.detail.preview.calendar.trigger')}
            >
              <span>
                {selected?.toLocaleDateString() ?? t('components.detail.preview.calendar.empty')}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="grid max-w-[var(--calendar-width)] gap-2">
            <span className="text-muted-foreground text-xs">
              {t('components.detail.preview.calendar.open')}
            </span>
            <div className="border-border/70 bg-background rounded-lg border p-1">
              <Calendar
                data-preview-state="open"
                mode="single"
                selected={selected}
                onSelect={onSelect}
              />
            </div>
          </div>
          <div className="border-border/70 bg-muted/30 min-w-36 rounded-lg border p-3 text-xs">
            <span className="text-muted-foreground block">
              {t('components.detail.preview.calendar.selected')}
            </span>
            <strong className="text-foreground mt-2 block">
              {selected?.toLocaleDateString() ?? t('components.detail.preview.calendar.empty')}
            </strong>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start px-2"
              onClick={() => onSelect(new Date())}
            >
              {t('components.detail.preview.calendar.today')}
            </Button>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function ShareDialogPreview({
  item,
  t,
}: {
  item: ComponentCatalogItem;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = useState(false);
  const content = useMemo<ShareContent>(
    () => ({
      title: item.name,
      slogan: t('components.detail.sharePreview.title'),
      result: t(item.descriptionKey),
      fullText: [item.name, t(item.descriptionKey)].join('\n'),
      landingUrl: typeof window === 'undefined' ? undefined : window.location.href,
    }),
    [item, t],
  );

  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.business.eyebrow')}
        title={t('components.business.shareTitle')}
        description={t('components.business.shareDescription')}
      />
      <PreviewBlock
        title={t('components.business.shareTitle')}
        description={t('components.detail.sharePreview.description')}
      >
        <Button type="button" onClick={() => setOpen(true)}>
          <Share2 aria-hidden="true" />
          {t('components.business.openShare')}
        </Button>
      </PreviewBlock>
      <ShareDialog
        open={open}
        content={content}
        onOpenChange={setOpen}
        title={t('components.detail.sharePreview.title')}
        description={t('components.detail.sharePreview.description')}
        poster={
          <div className="border-border bg-card rounded-[var(--radius-card)] border p-[var(--panel-padding-md)]">
            <p className="text-primary font-sans text-xs tracking-[0.12em] uppercase">
              {t('components.detail.sharePreview.status')}
            </p>
            <h3 className="text-foreground mt-3 text-xl font-semibold">{item.name}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t(item.descriptionKey)}
            </p>
          </div>
        }
      />
    </div>
  );
}

function GenericPreview({ item, t }: { item: ComponentCatalogItem; t: (key: string) => string }) {
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.generic.basicTitle')}>
        <div className="border-border/70 bg-muted/25 flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
          <span className="bg-primary/10 text-primary inline-grid size-10 place-items-center rounded-lg">
            <Layers3 size={18} aria-hidden="true" />
          </span>
          <strong className="text-foreground mt-3 text-sm">{item.name}</strong>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
            {t('components.detail.preview.generic.description')}
          </p>
        </div>
      </PreviewBlock>
    </div>
  );
}

function DetailIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-primary font-sans text-xs tracking-[0.12em] uppercase">{eyebrow}</p>
      <h2 className="text-foreground mt-2 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function PreviewBlock({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-border/70 bg-card rounded-xl border px-4 py-3 shadow-sm sm:px-4">
      <h3 className="text-foreground text-base leading-5 font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1 text-sm leading-5">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CodeBlock({
  title,
  code,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
  description,
  sourcePath,
  sourceLabel,
  sourceCopyLabel,
  onCopySource,
}: {
  title: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
  copiedLabel: string;
  description?: string;
  sourcePath?: string;
  sourceLabel?: string;
  sourceCopyLabel?: string;
  onCopySource?: () => void;
}) {
  const lines = code.split('\n');

  return (
    <section className="border-border/70 bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="min-w-0">
          <div className="text-foreground flex items-center gap-2 text-base font-semibold">
            <Code2 className="text-primary" size={16} aria-hidden="true" />
            <span>{title}</span>
          </div>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm leading-5">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-1 shrink-0"
          onClick={onCopy}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      <div className="bg-foreground text-background mx-4 mt-3 overflow-x-auto rounded-lg">
        <div className="grid min-w-max grid-cols-[2rem_minmax(0,1fr)] p-4 font-mono text-[12px] leading-6 sm:p-5 sm:text-[13px]">
          <div className="text-background/35 select-none pr-4 text-right" aria-hidden="true">
            {lines.map((_, index) => (
              <span key={index} className="block">
                {index + 1}
              </span>
            ))}
          </div>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      </div>
      {sourcePath ? (
        <div className="text-muted-foreground flex items-center justify-between gap-4 px-4 py-3 text-xs">
          <span className="flex min-w-0 items-center gap-2">
            <Code2 className="text-primary shrink-0" size={15} aria-hidden="true" />
            <span className="shrink-0">{sourceLabel}</span>
            <code className="truncate font-mono">{sourcePath}</code>
          </span>
          {onCopySource ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
              onClick={onCopySource}
            >
              <Copy size={14} aria-hidden="true" />
              {sourceCopyLabel ?? copyLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ApiTable({ rows, t }: { rows: readonly ApiRow[]; t: (key: string) => string }) {
  return (
    <div className="border-border/70 mt-6 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="bg-muted/45 text-muted-foreground text-xs">
          <tr>
            <th className="px-4 py-3 font-medium">{t('components.detail.api.columns.name')}</th>
            <th className="px-4 py-3 font-medium">{t('components.detail.api.columns.type')}</th>
            <th className="px-4 py-3 font-medium">{t('components.detail.api.columns.default')}</th>
            <th className="px-4 py-3 font-medium">
              {t('components.detail.api.columns.description')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-border/70 border-t align-top">
              <td className="text-foreground px-4 py-4 font-mono text-xs">{row.name}</td>
              <td className="text-muted-foreground px-4 py-4 font-mono text-xs">{row.type}</td>
              <td className="text-muted-foreground px-4 py-4 font-mono text-xs">
                {row.defaultValue}
              </td>
              <td className="text-muted-foreground px-4 py-4 leading-relaxed">
                {t(row.descriptionKey)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function createUsageCode(
  item: ComponentCatalogItem,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const codeBySlug: Record<string, string> = {
    button: `import { Button } from '@/shared/ui/button'

export function ButtonExample() {
  return (
    <div className="flex items-center gap-3">
      <Button>${t('components.detail.codeSamples.button.primary')}</Button>
      <Button variant="secondary">${t('components.detail.codeSamples.button.secondary')}</Button>
      <Button variant="ghost">${t('components.detail.preview.button.text')}</Button>
      <Button variant="destructive">${t('components.detail.codeSamples.button.destructive')}</Button>
    </div>
  )
}`,
    input: `import { Input } from '@/shared/ui/input'

<Input placeholder="${t('components.detail.codeSamples.input.placeholder')}" />`,
    textarea: `import { Textarea } from '@/shared/ui/textarea'

<Textarea placeholder="${t('components.detail.codeSamples.input.placeholder')}" />`,
    skeleton: `import { Skeleton } from '@/shared/ui/skeleton'

<div className="space-y-3">
  <Skeleton className="h-4 w-1/3" />
  <Skeleton className="h-4 w-2/3" />
  <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
</div>`,
    label: `import { Label } from '@/shared/ui/label'

<Label htmlFor="email">${t('components.detail.codeSamples.label.label')}</Label>`,
    select: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

<Select>
  <SelectTrigger><SelectValue placeholder="${t('components.detail.codeSamples.select.placeholder')}" /></SelectTrigger>
</Select>`,
    tabs: `import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

<Tabs defaultValue="preview">
  <TabsList>
    <TabsTrigger value="preview">${t('components.detail.codeSamples.tabs.preview')}</TabsTrigger>
  </TabsList>
</Tabs>`,
    dialog: `import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/shared/ui/dialog'

<Dialog>
  <DialogTrigger asChild><Button>${t('components.detail.codeSamples.dialog.open')}</Button></DialogTrigger>
  <DialogContent type="warning">
    ${t('components.detail.codeSamples.dialog.content')}
  </DialogContent>
</Dialog>`,
    'query-composer': `import { QueryComposer } from '@/shared/ui/QueryComposer'

<QueryComposer
  mode="natural_language_only"
  value={query}
  label="${t('components.input.label')}"
  messages={messages}
  onValueChange={setQuery}
  onCommitQuery={resolveQuery}
/>`,
    'share-dialog': `import { ShareDialog } from '@/features/share'

<ShareDialog
  open={open}
  content={content}
  poster={<ShareCard />}
  onOpenChange={setOpen}
/>`,
  };

  return codeBySlug[item.slug] ?? createFallbackUsageCode(item);
}

function createFallbackUsageCode(item: ComponentCatalogItem) {
  return `import { ${item.name} } from '${item.sourcePath}'

<${item.name} />`;
}
