import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/shared/utils/cn';

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(function PopoverTrigger({ ...props }, ref) {
  return <PopoverPrimitive.Trigger ref={ref} data-slot="popover-trigger" {...props} />;
});

PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

const PopoverClose = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Close>
>(function PopoverClose({ ...props }, ref) {
  return <PopoverPrimitive.Close ref={ref} data-slot="popover-close" {...props} />;
});

PopoverClose.displayName = PopoverPrimitive.Close.displayName;

export type PopoverContentVariant = 'default' | 'compact';

export type PopoverContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> & {
  /**
   * `compact` is the standard surface for action menus such as Share's platform picker.
   * It keeps the content width and padding stable without feature-local geometry overrides.
   */
  variant?: PopoverContentVariant;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverContent(
  { className, align = 'center', sideOffset = 4, variant = 'default', ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 flex max-w-[calc(100vw-var(--space-8))] origin-(--radix-popover-content-transform-origin) flex-col border border-border-subtle bg-popover text-[length:var(--font-size-md)] leading-[var(--line-height-md)] text-popover-foreground outline-none duration-[var(--duration-fast)] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:duration-0',
          variant === 'compact'
            ? 'w-[min(var(--popover-compact-width),calc(100vw-var(--space-8)))] gap-[var(--popover-compact-gap)] rounded-[var(--radius-control)] p-[var(--popover-compact-padding)] shadow-[var(--elevation-md)]'
            : 'w-[min(var(--popover-width),calc(100vw-var(--space-8)))] gap-[var(--space-2)] rounded-[var(--radius-panel)] p-[var(--popover-padding)] shadow-[var(--elevation-md)]',
          className,
        )}
        data-variant={variant}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn(
        'flex flex-col gap-[var(--space-1)] text-[length:var(--font-size-md)]',
        className,
      )}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="popover-title"
      className={cn(
        'text-[length:var(--font-size-md)] leading-[var(--line-height-md)] font-semibold',
        className,
      )}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="popover-description"
      className={cn(
        'text-[length:var(--font-size-md)] leading-[var(--line-height-base)] text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
