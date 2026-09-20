import * as React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown, ChevronUp } from '@/shared/icons';

import { cn } from '@/shared/utils/cn';

type SelectSize = 'sm' | 'md' | 'lg';

const SELECT_SIZE_CLASSES: Record<SelectSize, string> = {
  sm: 'h-[var(--input-height-sm)]',
  md: 'h-[var(--input-height-md)]',
  lg: 'h-[var(--input-height-lg)]',
};

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

type SelectTriggerProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
  'size'
> & {
  size?: SelectSize;
};

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
        'flex w-full min-w-0 items-center justify-between gap-[var(--input-icon-gap)] rounded-[var(--radius-control)] border border-[var(--control-border-width)] border-input bg-background px-[var(--input-padding-x)] text-[length:var(--font-size-md)] leading-[var(--line-height-md)] text-foreground outline-none transition-[color,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-border-strong focus-visible:[--tw-ring-width:var(--control-focus-stroke)] focus-visible:[--tw-ring-offset-width:var(--focus-ring-offset)] focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-offset-background data-[state=open]:border-ring data-[state=open]:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-[var(--disabled-opacity)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:[--tw-ring-width:var(--control-focus-stroke)] aria-invalid:ring-destructive/30 [&>span]:flex [&>span]:min-w-0 [&>span]:items-center [&>span]:gap-[var(--input-icon-gap)] [&>span]:truncate motion-reduce:transition-none',
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
  );
});

SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

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
          'relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--dropdown-min-width)] overflow-hidden rounded-[var(--radius-control)] border border-border-subtle bg-popover text-popover-foreground shadow-[var(--elevation-md)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-[var(--space-1)]',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

SelectContent.displayName = SelectPrimitive.Content.displayName;

function SelectLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        'px-[var(--dropdown-item-padding-x)] py-[var(--space-1)] text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        'relative flex h-[var(--dropdown-item-height)] w-full cursor-default items-center rounded-[var(--radius-control)] px-[var(--dropdown-item-padding-x)] pr-[calc(var(--dropdown-item-padding-x)+var(--control-icon-size)+var(--control-icon-gap))] text-[length:var(--font-size-md)] leading-[var(--line-height-md)] outline-none select-none focus:bg-surface-hover focus:text-foreground data-[state=checked]:bg-surface-selected data-[state=checked]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--disabled-opacity)]',
        className,
      )}
      {...props}
    >
      <span className="absolute right-[var(--dropdown-item-padding-x)] flex size-[var(--icon-size-md)] items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-[var(--icon-size-md)]" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

SelectItem.displayName = SelectPrimitive.Item.displayName;

function SelectSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        '-mx-[var(--space-1)] my-[var(--space-1)] h-[var(--control-border-width)] bg-border-subtle',
        className,
      )}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        'flex cursor-default items-center justify-center py-[var(--space-1)]',
        className,
      )}
      {...props}
    >
      <ChevronUp className="size-[var(--icon-size-md)]" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        'flex cursor-default items-center justify-center py-[var(--space-1)]',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-[var(--icon-size-md)]" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
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
};
