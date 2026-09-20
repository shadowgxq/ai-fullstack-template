import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/shared/utils/cn'

type TabsVisualVariant = 'segmented' | 'underline'

const Tabs = TabsPrimitive.Root

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: TabsVisualVariant
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(function TabsList({ className, variant = 'segmented', ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        'inline-flex h-[var(--tabs-height)] items-center justify-start gap-[var(--tabs-gap)] rounded-[var(--radius-control)] bg-muted p-[var(--tabs-padding)] text-muted-foreground',
        variant === 'underline' &&
          'w-full justify-start rounded-none border-b border-border-subtle bg-transparent !p-0',
        className,
      )}
      {...props}
    />
  )
})

TabsList.displayName = TabsPrimitive.List.displayName

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  variant?: TabsVisualVariant
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(function TabsTrigger({ className, variant = 'segmented', ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(
        'inline-flex h-[var(--tabs-trigger-height)] items-center justify-center gap-[var(--button-gap)] rounded-[var(--radius-control)] px-[var(--button-padding-x-sm)] text-[var(--font-size-md)] leading-[var(--line-height-md)] font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none hover:text-foreground focus-visible:[--tw-ring-width:var(--focus-ring-width)] focus-visible:[--tw-ring-offset-width:var(--focus-ring-offset)] focus-visible:ring-ring focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[var(--elevation-xs)] motion-reduce:transition-none',
        variant === 'underline' &&
          'h-[var(--tabs-height)] rounded-none border-b-[calc(var(--control-border-width)*2)] border-transparent !px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none',
        className,
      )}
      {...props}
    />
  )
})

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      className={cn(
        'mt-[var(--subsection-gap)] outline-none focus-visible:[--tw-ring-width:var(--focus-ring-width)] focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  )
})

TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsContent, TabsList, TabsTrigger }
