import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/shared/utils/cn'

type TabsVisualVariant = 'segmented' | 'underline'

const Tabs = TabsPrimitive.Root
const TabsVariantContext = React.createContext<TabsVisualVariant>('segmented')

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: TabsVisualVariant
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(function TabsList({ className, variant = 'segmented', ...props }, ref) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          'inline-flex h-[var(--tabs-height)] items-center justify-start gap-[var(--space-1)] rounded-[var(--radius-control)] bg-muted p-[var(--space-0-5)] text-muted-foreground',
          variant === 'underline' &&
            'w-full justify-start gap-[var(--space-6)] rounded-none bg-transparent !p-0 shadow-[inset_0_calc(var(--control-border-width)*-1)_0_var(--border-subtle)]',
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
})

TabsList.displayName = TabsPrimitive.List.displayName

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  variant?: TabsVisualVariant
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(function TabsTrigger({ className, variant, ...props }, ref) {
  const inheritedVariant = React.useContext(TabsVariantContext)
  const visualVariant = variant ?? inheritedVariant
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      data-variant={visualVariant}
      className={cn(
        'inline-flex h-[var(--tabs-trigger-height)] items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-control)] px-[var(--space-3)] text-[length:var(--font-size-md)] leading-[var(--control-leading)] font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none hover:text-foreground focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-offset-[length:var(--space-0-5)] focus-visible:ring-ring focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground motion-reduce:transition-none',
        visualVariant === 'underline' &&
          'h-[var(--tabs-height)] rounded-none !px-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_calc(var(--control-border-width)*-2)_0_var(--primary)]',
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
        'mt-[var(--space-6)] outline-none focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  )
})

TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsContent, TabsList, TabsTrigger }
