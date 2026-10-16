import * as React from 'react'
import { Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/shared/utils/cn'

type SelectSize = 'sm' | 'md' | 'lg'

const SELECT_SIZE_CLASSES: Record<SelectSize, string> = {
  sm: 'h-[var(--input-height-sm)]',
  md: 'h-[var(--input-height-md)]',
  lg: 'h-[var(--input-height-lg)]',
}

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

type SelectTriggerProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
  'size'
> & {
  size?: SelectSize
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(function SelectTrigger({ className, children, size = 'md', ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-control)] border-[length:var(--control-border-width)] border-input bg-background px-[calc(var(--space-3)-var(--control-border-width))] text-[length:var(--font-size-md)] leading-[var(--control-leading)] text-foreground font-normal data-[placeholder]:text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-border-strong focus-visible:border-ring data-[state=open]:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] aria-invalid:border-[var(--control-invalid-border)] [&>span]:flex [&>span]:min-w-0 [&>span]:items-center [&>span]:gap-[var(--space-2)] [&>span]:truncate motion-reduce:transition-none',
        SELECT_SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-[var(--icon-size-md)] shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})

SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="select-content"
        position={position}
        className={cn(
          'relative z-50 max-h-[var(--radix-select-content-available-height)] overflow-hidden rounded-[var(--radius-control)] border-[length:var(--control-border-width)] border-border-subtle bg-popover text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          position === 'popper' &&
            'w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)] data-[side=bottom]:translate-y-[var(--space-1)] data-[side=left]:-translate-x-[var(--space-1)] data-[side=right]:translate-x-[var(--space-1)] data-[side=top]:-translate-y-[var(--space-1)]',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className="p-[calc(var(--space-1)-var(--control-border-width))]"
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})

SelectContent.displayName = SelectPrimitive.Content.displayName

function SelectLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        'px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--font-size-xs)] leading-[var(--caption-leading)] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

type SelectItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
  icon?: React.ReactNode
  description?: React.ReactNode
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(function SelectItem(
  { className, children, icon, description, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const descriptionId = React.useId()
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      aria-describedby={
        [describedBy, description ? descriptionId : undefined].filter(Boolean).join(' ') || undefined
      }
      className={cn(
        'group/select-item relative flex gap-[var(--space-2)] min-h-[var(--dropdown-item-height)] w-full cursor-default items-center rounded-[var(--radius-control)] px-[var(--space-3)] py-[var(--space-2)] [overflow-wrap:anywhere] pr-[calc(var(--space-3)+var(--icon-size-md)+var(--space-2))] text-[length:var(--font-size-md)] leading-[var(--control-leading)] outline-none select-none focus:bg-surface-hover focus:text-foreground data-[state=checked]:bg-surface-selected data-[state=checked]:text-foreground data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-[calc(var(--disabled-opacity-percent)/100)]',
        className,
      )}
      {...props}
    >
      <span className="absolute right-[var(--space-3)] flex size-[var(--icon-size-md)] items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-[var(--icon-size-md)] text-primary" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      {icon ? (
        <span aria-hidden="true" className="flex size-[var(--icon-size-md)] shrink-0 items-center justify-center group-data-[state=checked]/select-item:text-primary [&_svg]:size-full">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-[var(--space-0-5)]">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? (
          <span id={descriptionId} className="text-muted-foreground text-[length:var(--font-size-xs)] leading-[var(--caption-leading)] font-normal">
            {description}
          </span>
        ) : null}
      </span>
    </SelectPrimitive.Item>
  )
})

SelectItem.displayName = SelectPrimitive.Item.displayName

function SelectSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('my-[var(--space-1)] h-[var(--control-border-width)] bg-border-subtle', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-[var(--space-1)]', className)}
      {...props}
    >
      <ChevronUp className="size-[var(--icon-size-md)]" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-[var(--space-1)]', className)}
      {...props}
    >
      <ChevronDown className="size-[var(--icon-size-md)]" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
