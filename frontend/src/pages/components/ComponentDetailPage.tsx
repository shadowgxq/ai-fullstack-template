import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Bell,
  Ban,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Code2,
  Copy,
  Eye,
  FileText,
  CornerDownLeft,
  Layers3,
  MoreHorizontal,
  Pencil,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
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
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
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
    type: "'sm' | 'default' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg'",
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
    name: 'loading',
    type: 'boolean',
    defaultValue: 'false',
    descriptionKey: 'components.detail.api.button.loading',
  },
  {
    name: 'loadingLabel',
    type: 'string',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.button.loadingLabel',
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

const textareaApiRows: readonly ApiRow[] = [
  {
    name: 'value / onChange',
    type: 'string / ChangeEventHandler<HTMLTextAreaElement>',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.textarea.value',
  },
  {
    name: 'rows / className',
    type: 'number / string',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.textarea.height',
  },
  {
    name: 'disabled / readOnly',
    type: 'boolean',
    defaultValue: 'false',
    descriptionKey: 'components.detail.api.textarea.state',
  },
];
const selectApiRows: readonly ApiRow[] = [
  {
    name: 'value / onValueChange',
    type: 'string / (value: string) => void',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.select.value',
  },
  {
    name: 'SelectTrigger.size',
    type: "'sm' | 'md' | 'lg'",
    defaultValue: "'md'",
    descriptionKey: 'components.detail.api.select.size',
  },
  {
    name: 'SelectItem.icon / description',
    type: 'ReactNode',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.select.content',
  },
  {
    name: 'SelectItem.disabled',
    type: 'boolean',
    defaultValue: 'false',
    descriptionKey: 'components.detail.api.select.disabled',
  },
];
const tabsApiRows: readonly ApiRow[] = [
  {
    name: 'TabsList.variant',
    type: "'segmented' | 'underline'",
    defaultValue: "'segmented'",
    descriptionKey: 'components.detail.api.tabs.variant',
  },
  {
    name: 'value / onValueChange',
    type: 'string / (value: string) => void',
    defaultValue: '—',
    descriptionKey: 'components.detail.api.tabs.value',
  },
  {
    name: 'TabsTrigger.disabled',
    type: 'boolean',
    defaultValue: 'false',
    descriptionKey: 'components.detail.api.tabs.disabled',
  },
];

const apiRowsBySlug: Record<string, readonly ApiRow[]> = {
  button: buttonApiRows,
  textarea: textareaApiRows,
  select: selectApiRows,
  tabs: tabsApiRows,
  dialog: dialogApiRows,
  skeleton: skeletonApiRows,
};

type QueryPreviewItem = Readonly<{ id: 'rules' | 'assets' | 'unavailable'; disabled?: boolean }>;
const queryPreviewItems: readonly QueryPreviewItem[] = [
  { id: 'rules' },
  { id: 'assets' },
  { id: 'unavailable', disabled: true },
];

const tooltipPreviewPositions = [
  { side: 'top', labelKey: 'components.detail.preview.tooltip.top', long: false },
  { side: 'bottom', labelKey: 'components.detail.preview.tooltip.bottom', long: false },
  { side: 'right', labelKey: 'components.detail.preview.tooltip.right', long: false },
  { side: 'left', labelKey: 'components.detail.preview.tooltip.long', long: true },
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
  const [selectValue, setSelectValue] = useState('');
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
      <div className="bg-background relative isolate min-h-full overflow-hidden">
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
                <h1 className="text-foreground text-[length:var(--text-page-title-size)] leading-[var(--page-title-leading)] font-semibold tracking-[-0.045em]">
                  {item.name}
                </h1>
                <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
                  {t(item.descriptionKey)}
                </p>
              </div>
              <span className="bg-secondary/70 text-foreground inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold">
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
              <div className="-m-[calc(var(--focus-ring-width)+var(--space-0-5))] overflow-x-auto p-[calc(var(--focus-ring-width)+var(--space-0-5))]">
                <TabsList variant="underline" className="w-full min-w-max">
                  {detailTabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {t(tab.labelKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

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
                  <p className="text-foreground font-sans text-xs tracking-[0.12em] uppercase">
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
          className="pl-[calc(var(--space-3)+var(--icon-size-md)+var(--space-2)-var(--control-border-width))]"
        />
      </div>

      <nav className="grid gap-6 max-[900px]:flex max-[900px]:gap-8 max-[900px]:overflow-x-auto max-[900px]:pb-2">
        {catalogCategories.map((category) => {
          const categoryItems = componentCatalog.filter(
            (candidate) => candidate.category === category,
          );

          return (
            <div key={category} className="min-w-[248px]">
              <h2 className="text-foreground mb-2 px-4 text-[15px] font-semibold">
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
                        isActive && 'bg-secondary text-foreground font-semibold',
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
  const [isPending, setIsPending] = useState(false);
  useEffect(() => {
    if (!isPending) return;
    const timer = window.setTimeout(() => setIsPending(false), 1200);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  return (
    <div className="space-y-4">
      <section className="border-border/70 bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <header className="flex items-start gap-4 border-b border-border/70 pb-4">
          <span className="bg-secondary/65 text-foreground inline-grid size-14 shrink-0 place-items-center rounded-xl">
            {createElement(Icon, {
              size: 25,
              strokeWidth: 2.1,
              'aria-hidden': true,
            })}
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-xl leading-7 font-semibold tracking-[-0.03em]">
              {t('components.detail.preview.button.cardTitle')}
            </h2>
            <p className="text-muted-foreground mt-[var(--space-4)] text-sm leading-[var(--body-leading)]">
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
            <div className="mt-3 grid grid-cols-3 gap-3 max-[640px]:grid-cols-2 max-[420px]:grid-cols-1">
              <Button type="button" className="w-full">
                {t('components.detail.preview.button.primary')}
              </Button>
              <Button type="button" variant="secondary" className="w-full">
                {t('components.detail.preview.button.secondary')}
              </Button>
              <Button type="button" variant="outline" className="w-full">
                {t('components.detail.preview.button.outline')}
              </Button>
              <Button type="button" variant="ghost" className="w-full">
                {t('components.detail.preview.button.ghost')}
              </Button>
              <Button type="button" variant="link" className="w-full">
                {t('components.detail.preview.button.link')}
              </Button>
              <Button type="button" variant="destructive" className="w-full">
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
              <Button type="button" variant="secondary" disabled className="w-full">
                {t('components.detail.preview.button.disabled')}
              </Button>
              <Button
                type="button"
                loading={isPending}
                onClick={() => setIsPending(true)}
                loadingLabel={t('components.detail.preview.button.loading')}
                className="w-full"
              >
                {t(
                  isPending
                    ? 'components.detail.preview.button.loading'
                    : 'components.detail.preview.button.run',
                )}
              </Button>
            </div>
          </section>

          {/* 此样例按设计使用内容高度，允许长标签自然撑开。 */}
          <Button type="button" className="w-full min-h-0 max-w-[400px]">
            {t('components.detail.preview.button.longLabel')}
          </Button>
          <section aria-labelledby="button-sizes-title">
            <h3
              id="button-sizes-title"
              className="text-foreground text-base leading-5 font-semibold"
            >
              {t('components.detail.preview.button.sizesTitle')}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="outline">
                {t('components.detail.preview.button.small')}
              </Button>
              <Button type="button">{t('components.detail.preview.button.defaultSize')}</Button>
              <Button type="button" size="lg">
                {t('components.detail.preview.button.large')}
              </Button>
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
    <div className="space-y-[var(--space-6)]">
      <section className="grid gap-[var(--space-6)] rounded-[var(--radius-surface)] border border-border-subtle bg-card p-[calc(var(--space-6)-var(--control-border-width))]">
        <h2 className="text-xs text-muted-foreground">
          {t('components.detail.preview.input.basicTitle')}
        </h2>
        <div className="grid items-center gap-[var(--space-8)] md:grid-cols-[minmax(0,1fr)_224px]">
          <div className="grid gap-[var(--space-2)]">
            <Label htmlFor="component-detail-input">
              {t('components.detail.preview.input.label')}
            </Label>
            <Input
              id="component-detail-input"
              value={value}
              placeholder={t('components.detail.preview.input.placeholder')}
              aria-describedby="component-detail-input-helper"
              onChange={(event) => onChange(event.target.value)}
            />
            <p id="component-detail-input-helper" className="text-xs text-muted-foreground">
              {t('components.detail.preview.input.helper')}
            </p>
          </div>
          <dl className="grid gap-[var(--space-3)] border-t border-border-subtle pt-[var(--space-6)] text-xs md:border-t-0 md:border-l md:pt-0 md:pl-[calc(var(--space-6)-var(--control-border-width))]">
            {(['height', 'radius', 'padding'] as const).map((parameter) => (
              <div key={parameter} className="flex justify-between gap-[var(--space-3)]">
                <dt className="text-muted-foreground">
                  {t(`components.detail.preview.input.geometry.${parameter}`)}
                </dt>
                <dd className="font-mono">
                  {{ height: '40px', radius: '8px', padding: '12px' }[parameter]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="space-y-[var(--space-3)]" aria-labelledby="input-states-title">
        <h2
          id="input-states-title"
          className="text-lg font-medium leading-[var(--card-title-leading)]"
        >
          {t('components.detail.preview.input.statesTitle')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('components.detail.preview.input.statesDescription')}
        </p>
        <div>
          {(['hover', 'focus', 'disabled', 'readonly', 'error'] as const).map((state) => (
            <div
              key={state}
              className="grid items-center gap-[var(--space-2)] border-b border-border-subtle pt-[var(--space-3)] pb-[calc(var(--space-3)-var(--control-border-width))] md:grid-cols-[136px_minmax(0,1fr)_224px] md:gap-[var(--space-6)]"
            >
              <Label
                htmlFor={`component-detail-input-${state}`}
                className="font-normal leading-[var(--control-leading)]"
              >
                {t(`components.detail.preview.input.${state}`)}
              </Label>
              <Input
                id={`component-detail-input-${state}`}
                placeholder={t('components.detail.preview.input.placeholder')}
                defaultValue={
                  state === 'focus'
                    ? t('components.detail.preview.input.focusValue')
                    : state === 'readonly'
                      ? t('components.detail.preview.input.readonlyValue')
                      : undefined
                }
                disabled={state === 'disabled'}
                readOnly={state === 'readonly'}
                aria-invalid={state === 'error' || undefined}
                aria-describedby={`component-detail-input-${state}-message`}
              />
              <p
                id={`component-detail-input-${state}-message`}
                className={cn(
                  'text-xs text-muted-foreground',
                  state === 'error' && 'text-destructive',
                )}
                role={state === 'error' ? 'alert' : undefined}
              >
                {t(`components.detail.preview.input.feedback.${state}`)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        {t('components.detail.preview.input.parameters')}
      </p>
    </div>
  );
}

function TextareaPreview({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [value, setValue] = useState(t('components.detail.preview.textarea.counterValue'));
  const [autoValue, setAutoValue] = useState(t('components.detail.preview.textarea.autoValue'));

  return (
    <div className="space-y-[var(--space-4)]">
      <SpecimenSection
        title={t('components.detail.preview.textarea.basicTitle')}
        description={t('components.detail.preview.textarea.basicDescription')}
      >
        <div className="grid gap-[var(--space-6)] lg:grid-cols-3">
          <div className="grid content-start gap-[var(--space-2)]">
            <Label htmlFor="component-detail-textarea">
              {t('components.detail.preview.textarea.label')}
            </Label>
            <Textarea
              id="component-detail-textarea"
              placeholder={t('components.detail.preview.textarea.placeholder')}
              aria-describedby="component-detail-textarea-helper"
            />
            <p id="component-detail-textarea-helper" className="text-xs text-muted-foreground">
              {t('components.detail.preview.textarea.helper')}
            </p>
          </div>
          <div className="grid content-start gap-[var(--space-2)]">
            <Label
              htmlFor="component-detail-textarea-counter"
              className="font-semibold leading-[var(--body-leading)]"
            >
              {t('components.detail.preview.textarea.counterLabel')}
            </Label>
            <Textarea
              id="component-detail-textarea-counter"
              value={value}
              maxLength={1000}
              aria-describedby="component-detail-textarea-counter-message"
              onChange={(event) => setValue(event.target.value)}
            />
            <p
              id="component-detail-textarea-counter-message"
              className="text-right text-xs text-muted-foreground"
              aria-live="polite"
            >
              {t('components.detail.preview.textarea.counter', { count: value.length })}
            </p>
          </div>
          <div className="grid content-start gap-[var(--space-2)]">
            <Label
              htmlFor="component-detail-textarea-auto"
              className="font-semibold leading-[var(--body-leading)]"
            >
              {t('components.detail.preview.textarea.autoHeight')}
            </Label>
            <Textarea
              id="component-detail-textarea-auto"
              value={autoValue}
              className="resize-none overflow-hidden"
              aria-describedby="component-detail-textarea-auto-helper"
              onChange={(event) => {
                setAutoValue(event.target.value);
                const field = event.currentTarget;
                field.style.height = 'auto';
                field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
              }}
            />
            <p id="component-detail-textarea-auto-helper" className="text-xs text-muted-foreground">
              {t('components.detail.preview.textarea.autoHelper')}
            </p>
          </div>
        </div>
      </SpecimenSection>
      <SpecimenSection title={t('components.detail.preview.textarea.statesTitle')}>
        <div className="grid gap-[var(--space-6)] lg:grid-cols-3">
          <div className="grid content-start gap-[var(--space-2)]">
            <Label
              htmlFor="component-detail-textarea-focus"
              className="font-semibold leading-[var(--body-leading)]"
            >
              {t('components.detail.preview.textarea.focus')}
            </Label>
            <Textarea
              id="component-detail-textarea-focus"
              defaultValue={t('components.detail.preview.textarea.focusValue')}
              aria-describedby="component-detail-textarea-focus-helper"
            />
            <p
              id="component-detail-textarea-focus-helper"
              className="text-xs text-muted-foreground"
            >
              {t('components.detail.preview.textarea.keyboardHint')}
            </p>
          </div>
          <div className="grid content-start gap-[var(--space-2)]">
            <Label
              htmlFor="component-detail-textarea-error"
              className="font-semibold leading-[var(--body-leading)]"
            >
              {t('components.detail.preview.textarea.error')}
            </Label>
            <Textarea
              id="component-detail-textarea-error"
              aria-invalid="true"
              aria-describedby="component-detail-textarea-error-message"
              placeholder={t('components.detail.preview.textarea.placeholder')}
            />
            <p
              id="component-detail-textarea-error-message"
              className="text-xs text-destructive"
              role="alert"
            >
              {t('components.detail.preview.textarea.errorMessage')}
            </p>
          </div>
          <div className="grid content-start gap-[var(--space-2)]">
            <Label
              htmlFor="component-detail-textarea-disabled"
              className="font-semibold leading-[var(--body-leading)]"
            >
              {t('components.detail.preview.textarea.disabled')}
            </Label>
            <Textarea
              id="component-detail-textarea-disabled"
              disabled
              placeholder={t('components.detail.preview.textarea.placeholder')}
              aria-describedby="component-detail-textarea-disabled-helper"
            />
            <p
              id="component-detail-textarea-disabled-helper"
              className="text-xs text-muted-foreground"
            >
              {t('components.detail.preview.textarea.disabledHelper')}
            </p>
          </div>
        </div>
      </SpecimenSection>
      <SpecimenSection
        title={t('components.detail.preview.textarea.heightTitle')}
        description={t('components.detail.preview.textarea.heightHint')}
      />
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
          className="grid gap-6 sm:grid-cols-2"
          role="status"
          aria-busy="true"
          aria-label={t('components.detail.preview.skeleton.loadingLabel')}
        >
          <div className="space-y-[var(--space-2)]">
            <h3>{t('components.detail.preview.skeleton.form')}</h3>
            {[0, 1].map((n) => (
              <div key={n} className="space-y-[var(--space-1)]">
                <Skeleton className="h-1.5 w-14" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-[var(--space-2)]">
            <h3>{t('components.detail.preview.skeleton.list')}</h3>
            {[0, 1, 2].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-[var(--radius-pill)]" />
                <div className="flex-1 space-y-[var(--space-1)]">
                  <Skeleton className="h-2 w-[88px]" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-[var(--space-2)]">
            <h3>{t('components.detail.preview.skeleton.cards')}</h3>
            <div className="grid grid-cols-3 gap-[var(--space-2)]">
              {[0, 1, 2].map((n) => (
                <div key={n} className="space-y-[var(--space-2)]">
                  <Skeleton className="h-[66px] w-full" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-1.5 w-10" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-[var(--space-2)]">
            <h3>{t('components.detail.preview.skeleton.table')}</h3>
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <Skeleton className="h-1.5 w-5" />
                <Skeleton className="h-1.5 flex-1" />
                <Skeleton className="h-1.5 w-10" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground mt-5 text-xs">
          {t('components.detail.preview.skeleton.motionHint')}
        </p>
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
  const [mode, setMode] = useState<'remote_only' | 'natural_language_only' | 'hybrid'>('hybrid');
  const [scenario, setScenario] = useState<'ready' | 'empty' | 'error'>('ready');
  const [isMultiline, setIsMultiline] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const failNextSearch = useRef(false);
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
      search: async (query: string, { signal }: { signal: AbortSignal }) => {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 400);
          signal.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
        if (signal.aborted || scenario === 'empty') return [];
        if (scenario === 'error' && failNextSearch.current) {
          failNextSearch.current = false;
          throw new Error('Preview search failed');
        }
        const normalized = query.trim().toLocaleLowerCase();
        return queryPreviewItems.filter((item) =>
          t(`components.detail.preview.query.items.${item.id}.title`)
            .toLocaleLowerCase()
            .includes(normalized),
        );
      },
    }),
    [scenario, t],
  );
  const previewKey = `${mode}:${scenario}`;
  const common = {
    value,
    label: t('components.detail.preview.query.label'),
    description: t('components.detail.preview.query.description'),
    placeholder: t('components.detail.preview.query.placeholder'),
    messages,
    onValueChange: setValue,
    isMultiline,
    isDisabled,
    validationMessage: showValidation
      ? t('components.detail.preview.query.validationHint')
      : undefined,
  };
  const remote = {
    remoteSearch,
    getItemKey: (item: QueryPreviewItem) => item.id,
    isItemDisabled: (item: QueryPreviewItem) => Boolean(item.disabled),
    onCommitItem: (item: QueryPreviewItem) =>
      setCommitted(t(`components.detail.preview.query.items.${item.id}.title`)),
    renderItem: (item: QueryPreviewItem, state: { isActive: boolean; isDisabled: boolean }) => (
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <strong className="font-medium">
            {t(`components.detail.preview.query.items.${item.id}.title`)}
          </strong>
          <span className="text-muted-foreground text-xs">
            {t(`components.detail.preview.query.items.${item.id}.description`)}
          </span>
        </span>
        {state.isActive ? (
          <CornerDownLeft className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        ) : null}
      </span>
    ),
  };
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.input.eyebrow')}
        title={t('components.input.title')}
        description={t('components.input.description')}
      />
      <PreviewBlock title={t('components.input.contractTitle')}>
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="query-preview-mode">{t('components.detail.preview.query.mode')}</Label>
            <Select
              value={mode}
              onValueChange={(next) => {
                if (next === 'hybrid' || next === 'remote_only' || next === 'natural_language_only')
                  setMode(next);
              }}
            >
              <SelectTrigger id="query-preview-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['hybrid', 'remote_only', 'natural_language_only'].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="query-preview-scenario">
              {t('components.detail.preview.query.scenario')}
            </Label>
            <Select
              value={scenario}
              onValueChange={(next) => {
                if (next === 'ready' || next === 'empty' || next === 'error') {
                  failNextSearch.current = next === 'error';
                  setScenario(next);
                }
              }}
            >
              <SelectTrigger id="query-preview-scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['ready', 'empty', 'error'].map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`components.detail.preview.query.scenarios.${item}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { id: 'multiline', value: isMultiline, change: setIsMultiline },
              { id: 'disabled', value: isDisabled, change: setIsDisabled },
              { id: 'validation', value: showValidation, change: setShowValidation },
            ].map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Switch
                  id={`query-preview-${option.id}`}
                  checked={option.value}
                  onCheckedChange={option.change}
                />
                <Label htmlFor={`query-preview-${option.id}`}>
                  {t(`components.detail.preview.query.${option.id}`)}
                </Label>
              </div>
            ))}
          </div>
        </div>
        {mode === 'natural_language_only' ? (
          <QueryComposer
            key={previewKey}
            {...common}
            mode="natural_language_only"
            onCommitQuery={setCommitted}
          />
        ) : mode === 'remote_only' ? (
          <QueryComposer<QueryPreviewItem>
            key={previewKey}
            {...common}
            {...remote}
            mode="remote_only"
          />
        ) : (
          <QueryComposer<QueryPreviewItem>
            key={previewKey}
            {...common}
            {...remote}
            mode="hybrid"
            onCommitQuery={setCommitted}
            renderFreeform={(query) => t('components.input.freeformValue', { value: query })}
          />
        )}
        <p className="text-muted-foreground mt-4 text-sm" aria-live="polite">
          {committed
            ? t('components.input.committed', { value: committed })
            : t('components.input.commitEmpty')}
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          {t('components.detail.preview.query.keyboardHint')}
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
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="component-detail-label-input"
              required
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
  const [setting, setSetting] = useState('account');
  const [recoveredValue, setRecoveredValue] = useState('');
  const settings = [
    { value: 'account', icon: UserRound, group: 'common', description: true },
    { value: 'notifications', icon: Bell, group: 'common', description: true },
    { value: 'appearance', icon: Settings, group: 'common', description: true },
    { value: 'advanced', icon: SlidersHorizontal, group: 'more', description: false },
    { value: 'help', icon: BookOpen, group: 'more', description: false },
    { value: 'organization', icon: Ban, group: 'more', description: false, disabled: true },
  ];
  const optionItems = (['one', 'two', 'three'] as const).map((option) => (
    <SelectItem key={option} value={option}>
      {t(`components.detail.preview.select.options.${option}`)}
    </SelectItem>
  ));
  return (
    <div className="space-y-[var(--space-6)]">
      <div className="grid items-start gap-[var(--space-6)] xl:grid-cols-[minmax(0,1.8fr)_minmax(240px,1fr)]">
        <div className="grid gap-[var(--space-4)]">
          <SpecimenSection
            compact
            className="gap-[var(--space-5)]"
            title={t('components.detail.preview.select.basicTitle')}
            description={t('components.detail.preview.select.basicDescription')}
          >
            <div className="grid items-start gap-[var(--space-6)] md:grid-cols-2">
              {(['default', 'hover', 'focus', 'selected', 'disabled', 'invalid'] as const).map(
                (state) => (
                  <div key={state} className="grid gap-[var(--space-2)]">
                    <Label
                      htmlFor={`component-detail-select-${state}`}
                      className={
                        state === 'default'
                          ? undefined
                          : 'font-normal leading-[var(--body-leading)]'
                      }
                    >
                      {t(`components.detail.preview.select.states.${state}`)}
                    </Label>
                    <Select
                      disabled={state === 'disabled'}
                      defaultValue={state === 'selected' ? 'one' : undefined}
                      value={
                        state === 'default'
                          ? value
                          : state === 'invalid'
                            ? recoveredValue
                            : undefined
                      }
                      onValueChange={
                        state === 'default'
                          ? onChange
                          : state === 'invalid'
                            ? setRecoveredValue
                            : undefined
                      }
                    >
                      <SelectTrigger
                        id={`component-detail-select-${state}`}
                        aria-invalid={(state === 'invalid' && !recoveredValue) || undefined}
                        aria-describedby={
                          state === 'invalid' && !recoveredValue ? 'select-validation' : undefined
                        }
                      >
                        <SelectValue
                          placeholder={t('components.detail.preview.select.placeholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>{optionItems}</SelectContent>
                    </Select>
                    {state === 'invalid' && !recoveredValue ? (
                      <p
                        id="select-validation"
                        className="flex items-center gap-[var(--space-1)] text-xs text-destructive leading-[var(--body-leading)]"
                        role="alert"
                      >
                        <CircleAlert
                          aria-hidden="true"
                          className="size-[var(--icon-size-sm)] shrink-0"
                        />
                        {t('components.detail.preview.select.error')}
                      </p>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </SpecimenSection>
          <SpecimenSection
            compact
            title={t('components.detail.preview.select.sizesTitle')}
            description={t('components.detail.preview.select.sizesDescription')}
          >
            <div className="grid gap-[var(--space-3)] md:grid-cols-3">
              {(['lg', 'md', 'sm'] as const).map((size) => (
                <div key={size} className="grid content-start gap-[var(--space-3)]">
                  <Label
                    htmlFor={`select-size-${size}`}
                    className="text-xs font-normal leading-[var(--body-leading)]"
                  >
                    {t(`components.detail.preview.select.sizes.${size}`)}
                  </Label>
                  <Select>
                    <SelectTrigger id={`select-size-${size}`} size={size}>
                      <SelectValue
                        placeholder={t('components.detail.preview.select.placeholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>{optionItems}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground leading-[var(--body-leading)]">
                    {{ lg: 44, md: 40, sm: 36 }[size]}px / 14px
                  </p>
                </div>
              ))}
            </div>
          </SpecimenSection>
          <SpecimenSection
            compact
            title={t('components.detail.preview.select.compositionTitle')}
            description={t('components.detail.preview.select.compositionDescription')}
          >
            <div className="grid gap-[var(--space-4)]">
              <Label
                htmlFor="select-department"
                className="font-normal leading-[var(--body-leading)]"
              >
                {t('components.detail.preview.select.department')}
              </Label>
              <Select defaultValue="design">
                <SelectTrigger id="select-department" aria-describedby="select-department-helper">
                  <UserRound
                    className="size-[var(--icon-size-md)] shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['design', 'engineering'] as const).map((team) => (
                    <SelectItem key={team} value={team}>
                      {t(`components.detail.preview.select.teams.${team}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="select-department-helper" className="text-xs text-muted-foreground">
                {t('components.detail.preview.select.departmentHelper')}
              </p>
            </div>
          </SpecimenSection>
        </div>
        <section className="grid gap-[var(--space-4)]" aria-labelledby="select-rich-title">
          <Label id="select-rich-title" htmlFor="component-detail-select-rich">
            {t('components.detail.preview.select.rich')}
          </Label>
          <Select value={setting} onValueChange={setSetting}>
            <SelectTrigger id="component-detail-select-rich">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['common', 'more'].map((group, index) => (
                <SelectGroup key={group}>
                  {index > 0 ? <SelectSeparator /> : null}
                  <SelectLabel>{t(`components.detail.preview.select.groups.${group}`)}</SelectLabel>
                  {settings
                    .filter((option) => option.group === group)
                    .map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        textValue={t(`components.detail.preview.select.settings.${option.value}`)}
                        icon={createElement(option.icon)}
                        description={
                          option.description
                            ? t(`components.detail.preview.select.descriptions.${option.value}`)
                            : undefined
                        }
                        disabled={option.disabled}
                      >
                        {t(`components.detail.preview.select.settings.${option.value}`)}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('components.detail.preview.select.richHint')}
          </p>
        </section>
      </div>
      <p className="border-t border-border-subtle pt-[var(--space-4)] text-xs text-muted-foreground">
        {t('components.detail.preview.select.keyboardHint')}
      </p>
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
        <div className="space-y-6">
          {(['segmented', 'underline'] as const).map((variant) => (
            <section key={variant} className="space-y-3">
              <h3>{t(`components.detail.preview.tabs.${variant}`)}</h3>
              <Tabs defaultValue="preview">
                <div className="-m-[calc(var(--focus-ring-width)+var(--space-0-5))] overflow-x-auto p-[calc(var(--focus-ring-width)+var(--space-0-5))]">
                  <TabsList
                    variant={variant}
                    className="w-full min-w-max"
                    aria-label={t(`components.detail.preview.tabs.${variant}`)}
                  >
                    {['preview', 'code', 'features'].map((value) => (
                      <TabsTrigger key={value} value={value} className="flex-1">
                        {t(`components.detail.preview.tabs.${value}`)}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="history" className="flex-1" disabled>
                      {t('components.detail.preview.tabs.history')}
                    </TabsTrigger>
                  </TabsList>
                </div>
                {['preview', 'code', 'features'].map((value) => (
                  <TabsContent key={value} value={value} className="text-muted-foreground text-sm">
                    {t(`components.detail.preview.tabs.${value}Content`)}
                  </TabsContent>
                ))}
              </Tabs>
            </section>
          ))}
        </div>
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setActiveDialog({ type, size: 'md' });
              }}
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
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setActiveDialog({ type: 'default', size: value });
            }}
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
          size={activeDialog?.size ?? 'md'}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          closeLabel={t('components.detail.preview.dialog.close')}
        >
          <DialogHeader>
            <DialogTitle>{t(`${activeCopyKey}.title`)}</DialogTitle>
            <DialogDescription>{t(`${activeCopyKey}.description`)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t(`${activeCopyKey}.cancel`)}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="button" variant={activeType === 'danger' ? 'destructive' : 'default'}>
                {t(`${activeCopyKey}.action`)}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DropdownPreview({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [selection, setSelection] = useState('newest');
  const [lastAction, setLastAction] = useState('');
  const action = (key: string) => setLastAction(t(`components.detail.preview.dropdown.${key}`));
  return (
    <div className="space-y-7">
      <DetailIntro
        eyebrow={t('components.detail.preview.eyebrow')}
        title={t('components.detail.preview.title')}
        description={t('components.detail.preview.description')}
      />
      <PreviewBlock title={t('components.detail.preview.dropdown.basicTitle')}>
        <div className="flex flex-wrap gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                {t('components.detail.preview.dropdown.open')}
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => action('first')}>
                <Eye aria-hidden="true" />
                {t('components.detail.preview.dropdown.first')}
                <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => action('edit')}>
                <Pencil aria-hidden="true" />
                {t('components.detail.preview.dropdown.edit')}
                <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => action('duplicate')}>
                <Copy aria-hidden="true" />
                {t('components.detail.preview.dropdown.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {t('components.detail.preview.dropdown.unavailable')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => action('delete')}>
                <Trash2 aria-hidden="true" />
                {t('components.detail.preview.dropdown.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                {t('components.detail.preview.dropdown.grouped')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {t('components.detail.preview.dropdown.group')}
                </DropdownMenuLabel>
                {['first', 'edit', 'duplicate'].map((key) => (
                  <DropdownMenuItem key={key} onSelect={() => action(key)}>
                    {t(`components.detail.preview.dropdown.${key}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {t('components.detail.preview.dropdown.more')}
                </DropdownMenuLabel>
                <DropdownMenuItem disabled>
                  {t('components.detail.preview.dropdown.unavailable')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => action('delete')}>
                  {t('components.detail.preview.dropdown.delete')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                {t('components.detail.preview.dropdown.sort')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{t('components.detail.preview.dropdown.sort')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={selection} onValueChange={setSelection}>
                {['newest', 'oldest', 'ascending', 'descending'].map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {t(`components.detail.preview.dropdown.sortOptions.${value}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-muted-foreground mt-4 text-sm" role="status">
          {lastAction
            ? t('components.detail.preview.dropdown.actionFeedback', { value: lastAction })
            : t('components.detail.preview.dropdown.selection', {
                value: t(`components.detail.preview.dropdown.sortOptions.${selection}`),
              })}
        </p>
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
        <div className="flex flex-wrap gap-4">
          {(['default', 'compact'] as const).map((variant) => (
            <Popover key={variant}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline">
                  {t(
                    variant === 'default'
                      ? 'components.detail.preview.popover.open'
                      : 'components.detail.preview.popover.compact',
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent variant={variant} align="start">
                <PopoverHeader>
                  <PopoverTitle>{t('components.detail.preview.popover.title')}</PopoverTitle>
                  <PopoverDescription>
                    {t('components.detail.preview.popover.description')}
                  </PopoverDescription>
                </PopoverHeader>
                <PopoverClose asChild>
                  <Button type="button" variant="outline">
                    {t('components.detail.preview.popover.close')}
                  </Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          {t('components.detail.preview.popover.keyboardHint')}
        </p>
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
            {tooltipPreviewPositions.map(({ side, labelKey, long }) => (
              <div key={side} className="grid justify-items-center gap-2 pt-8">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <MoreHorizontal size={17} aria-hidden="true" />
                      {t(labelKey)}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={side}>
                    {t(
                      long
                        ? 'components.detail.preview.tooltip.longContent'
                        : 'components.detail.preview.tooltip.content',
                    )}
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
                  defaultChecked={stateChecked}
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
          <div className="border-border bg-card rounded-[var(--radius-surface)] border p-[var(--space-5)]">
            <p className="text-foreground font-sans text-xs tracking-[0.12em] uppercase">
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
          <span className="bg-primary/10 text-foreground inline-grid size-10 place-items-center rounded-lg">
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
      <p className="text-foreground font-sans text-xs tracking-[0.12em] uppercase">{eyebrow}</p>
      <h2 className="text-foreground mt-2 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function SpecimenSection({
  children,
  title,
  description,
  compact = false,
  className,
}: {
  children?: ReactNode;
  title: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'grid gap-[var(--space-4)] rounded-[var(--radius-surface)] border border-border-subtle bg-card',
        compact
          ? 'p-[calc(var(--space-5)-var(--control-border-width))]'
          : 'p-[calc(var(--space-6)-var(--control-border-width))]',
        className,
      )}
    >
      <h3
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-lg leading-[var(--body-leading)]' : 'text-xl',
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            'text-muted-foreground leading-[var(--body-leading)]',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      ) : null}
      {children}
    </section>
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
    <section className="border-border-subtle bg-card rounded-[var(--radius-surface)] border px-4 py-3 sm:px-4">
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
            <Code2 className="text-foreground" size={16} aria-hidden="true" />
            <span>{title}</span>
          </div>
          {description ? (
            <p className="text-muted-foreground mt-[var(--space-4)] text-sm leading-[var(--body-leading)]">
              {description}
            </p>
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
            <Code2 className="text-foreground shrink-0" size={15} aria-hidden="true" />
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
      <Button variant="outline">${t('components.detail.preview.button.outline')}</Button>
      <Button variant="link">${t('components.detail.preview.button.link')}</Button>
      <Button variant="ghost">${t('components.detail.preview.button.ghost')}</Button>
      <Button variant="destructive">${t('components.detail.codeSamples.button.destructive')}</Button>
    </div>
  )
}`,
    input: `import { Input } from '@/shared/ui/input'

<Input placeholder="${t('components.detail.codeSamples.input.placeholder')}" />`,
    textarea: `import { Textarea } from '@/shared/ui/textarea'

<Textarea placeholder="${t('components.detail.codeSamples.input.placeholder')}" />`,
    skeleton: `import { Skeleton } from '@/shared/ui/skeleton'

<div className="space-y-3" role="status" aria-busy="true" aria-label="${t('components.detail.preview.skeleton.loadingLabel')}">
  <Skeleton className="h-4 w-1/3" />
  <Skeleton className="h-4 w-2/3" />
  <Skeleton className="h-24 w-full rounded-[var(--radius-surface)]" />
</div>`,
    label: `import { Label } from '@/shared/ui/label'

<Label htmlFor="email">${t('components.detail.codeSamples.label.label')}</Label>`,
    select: `import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

<Select defaultValue="one">
  <SelectTrigger aria-label="${t('components.detail.preview.select.label')}"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>${t('components.detail.preview.select.groups.common')}</SelectLabel>
      <SelectItem value="one" description="${t('components.detail.preview.select.descriptions.account')}">${t('components.detail.preview.select.options.one')}</SelectItem>
      <SelectItem value="two">${t('components.detail.preview.select.options.two')}</SelectItem>
      <SelectItem value="three" disabled>${t('components.detail.preview.select.options.three')}</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>`,
    tabs: `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

<Tabs defaultValue="preview">
  <TabsList variant="underline">
    <TabsTrigger value="preview">${t('components.detail.codeSamples.tabs.preview')}</TabsTrigger>
    <TabsTrigger value="code">${t('components.detail.preview.tabs.code')}</TabsTrigger>
  </TabsList>
  <TabsContent value="preview">${t('components.detail.preview.tabs.previewContent')}</TabsContent>
  <TabsContent value="code">${t('components.detail.preview.tabs.codeContent')}</TabsContent>
</Tabs>`,
    dialog: `import { Button } from '@/shared/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/shared/ui/dialog'

<Dialog>
  <DialogTrigger asChild><Button>${t('components.detail.codeSamples.dialog.open')}</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>${t('components.detail.preview.dialog.types.default.title')}</DialogTitle>
      <DialogDescription>${t('components.detail.preview.dialog.types.default.description')}</DialogDescription>
    </DialogHeader>
    <DialogClose asChild><Button variant="outline">${t('components.detail.preview.dialog.close')}</Button></DialogClose>
  </DialogContent>
</Dialog>`,
    'dropdown-menu': `import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

<DropdownMenu>
  <DropdownMenuTrigger asChild><Button variant="outline">${t('components.detail.preview.dropdown.open')}</Button></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onSelect={onEdit}>${t('components.detail.preview.dropdown.edit')}</DropdownMenuItem>
    <DropdownMenuItem disabled>${t('components.detail.preview.dropdown.unavailable')}</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    popover: `import { Button } from '@/shared/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from '@/shared/ui/popover'

<Popover>
  <PopoverTrigger asChild><Button variant="outline">${t('components.detail.preview.popover.open')}</Button></PopoverTrigger>
  <PopoverContent>
    <PopoverTitle>${t('components.detail.preview.popover.title')}</PopoverTitle>
    <PopoverClose asChild><Button variant="outline">${t('components.detail.preview.popover.close')}</Button></PopoverClose>
  </PopoverContent>
</Popover>`,
    tooltip: `import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button variant="outline">${t('components.detail.preview.tooltip.top')}</Button></TooltipTrigger>
    <TooltipContent>${t('components.detail.preview.tooltip.content')}</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    switch: `import { Switch } from '@/shared/ui/switch'

<Switch aria-label="${t('components.detail.preview.switch.label')}" defaultChecked />`,
    calendar: `import { Calendar } from '@/shared/ui/calendar'

<Calendar mode="single" selected={date} onSelect={setDate} />`,
    'query-composer': `import { QueryComposer } from '@/shared/ui/QueryComposer'

<QueryComposer
  mode="natural_language_only"
  value={query}
  label="${t('components.detail.preview.query.label')}"
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
