import {
  CalendarDays,
  Code2,
  Info,
  LayoutGrid,
  Menu,
  MessageCircle,
  MessageSquare,
  RectangleHorizontal,
  Share2,
  Square,
  ToggleRight,
  Type,
  ChevronsDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const catalogCategories = ['shared', 'advanced'] as const;

export type CatalogCategory = (typeof catalogCategories)[number];
export type CatalogFilter = 'all' | CatalogCategory;

export type ComponentCatalogItem = Readonly<{
  slug: string;
  name: string;
  category: CatalogCategory;
  sourcePath: string;
  descriptionKey: string;
}>;

export const componentCatalog: readonly ComponentCatalogItem[] = [
  {
    slug: 'button',
    name: 'Button',
    category: 'shared',
    sourcePath: 'src/shared/ui/button.tsx',
    descriptionKey: 'components.catalog.items.button.description',
  },
  {
    slug: 'input',
    name: 'Input',
    category: 'shared',
    sourcePath: 'src/shared/ui/input.tsx',
    descriptionKey: 'components.catalog.items.input.description',
  },
  {
    slug: 'label',
    name: 'Label',
    category: 'shared',
    sourcePath: 'src/shared/ui/label.tsx',
    descriptionKey: 'components.catalog.items.label.description',
  },
  {
    slug: 'select',
    name: 'Select',
    category: 'shared',
    sourcePath: 'src/shared/ui/select.tsx',
    descriptionKey: 'components.catalog.items.select.description',
  },
  {
    slug: 'tabs',
    name: 'Tabs',
    category: 'shared',
    sourcePath: 'src/shared/ui/tabs.tsx',
    descriptionKey: 'components.catalog.items.tabs.description',
  },
  {
    slug: 'dialog',
    name: 'Dialog',
    category: 'shared',
    sourcePath: 'src/shared/ui/dialog.tsx',
    descriptionKey: 'components.catalog.items.dialog.description',
  },
  {
    slug: 'dropdown-menu',
    name: 'DropdownMenu',
    category: 'shared',
    sourcePath: 'src/shared/ui/dropdown-menu.tsx',
    descriptionKey: 'components.catalog.items.dropdownMenu.description',
  },
  {
    slug: 'popover',
    name: 'Popover',
    category: 'shared',
    sourcePath: 'src/shared/ui/popover.tsx',
    descriptionKey: 'components.catalog.items.popover.description',
  },
  {
    slug: 'tooltip',
    name: 'Tooltip',
    category: 'shared',
    sourcePath: 'src/shared/ui/tooltip.tsx',
    descriptionKey: 'components.catalog.items.tooltip.description',
  },
  {
    slug: 'switch',
    name: 'Switch',
    category: 'shared',
    sourcePath: 'src/shared/ui/switch.tsx',
    descriptionKey: 'components.catalog.items.switch.description',
  },
  {
    slug: 'calendar',
    name: 'Calendar',
    category: 'shared',
    sourcePath: 'src/shared/ui/calendar.tsx',
    descriptionKey: 'components.catalog.items.calendar.description',
  },
  {
    slug: 'textarea',
    name: 'Textarea',
    category: 'shared',
    sourcePath: 'src/shared/ui/textarea.tsx',
    descriptionKey: 'components.catalog.items.textarea.description',
  },
  {
    slug: 'skeleton',
    name: 'Skeleton',
    category: 'shared',
    sourcePath: 'src/shared/ui/skeleton.tsx',
    descriptionKey: 'components.catalog.items.skeleton.description',
  },
  {
    slug: 'query-composer',
    name: 'QueryComposer',
    category: 'advanced',
    sourcePath: 'src/shared/ui/QueryComposer/',
    descriptionKey: 'components.catalog.items.queryComposer.description',
  },
  {
    slug: 'share-dialog',
    name: 'ShareDialog',
    category: 'advanced',
    sourcePath: 'src/features/share/ui/ShareDialog/ShareDialog.tsx',
    descriptionKey: 'components.catalog.items.shareDialog.description',
  },
];

export const componentIcons: Readonly<Record<string, LucideIcon>> = {
  button: RectangleHorizontal,
  input: Square,
  label: Type,
  select: ChevronsDown,
  tabs: LayoutGrid,
  dialog: MessageSquare,
  'dropdown-menu': Menu,
  popover: MessageCircle,
  tooltip: Info,
  switch: ToggleRight,
  calendar: CalendarDays,
  textarea: Square,
  skeleton: Square,
  'query-composer': Code2,
  'share-dialog': Share2,
};

export function getCatalogIcon(slug: string) {
  return componentIcons[slug] ?? LayoutGrid;
}

export function getCatalogItem(slug: string | undefined) {
  return componentCatalog.find((item) => item.slug === slug);
}
