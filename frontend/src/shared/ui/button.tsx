import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { LoaderCircle } from '@/shared/icons';

import { cn } from '@/shared/utils/cn';

const buttonVariants = cva(
  'group/button inline-flex touch-manipulation shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-clip-padding text-[length:var(--font-size-md)] leading-[var(--line-height-md)] font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none select-none focus-visible:[--tw-ring-width:var(--focus-ring-width)] focus-visible:[--tw-ring-offset-width:var(--focus-ring-offset)] focus-visible:ring-ring focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] aria-busy:opacity-100 aria-invalid:border-[var(--control-invalid-border)] aria-invalid:[--tw-ring-width:var(--control-focus-stroke)] aria-invalid:ring-destructive/20 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-[var(--icon-size-md)]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        outline:
          'border-border bg-background text-foreground hover:border-border-strong hover:bg-surface-hover active:bg-surface-selected',
        secondary:
          'border-border/70 bg-secondary text-secondary-foreground hover:bg-muted active:bg-surface-selected',
        ghost: 'bg-transparent text-foreground hover:bg-surface-hover active:bg-surface-selected',
        destructive:
          'border-destructive/20 bg-destructive-subtle text-destructive hover:bg-destructive/20 active:bg-destructive/30 focus-visible:ring-destructive',
        link: '!h-auto !gap-0 !px-0 bg-transparent text-primary underline-offset-[var(--space-1)] hover:text-primary-hover hover:underline active:translate-y-0',
      },
      size: {
        // 保留旧 API 别名，但不再引入另一套几何：xs 与 icon-xs 对齐 compact。
        xs: 'h-[var(--button-height-sm)] gap-[var(--button-gap)] px-[var(--button-padding-x-sm)]',
        sm: 'h-[var(--button-height-sm)] gap-[var(--button-gap)] px-[var(--button-padding-x-sm)]',
        default:
          'h-[var(--button-height-md)] gap-[var(--button-gap)] px-[var(--button-padding-x-md)]',
        lg: 'h-[var(--button-height-lg)] gap-[var(--button-gap)] px-[var(--button-padding-x-lg)]',
        icon: 'size-[var(--button-height-md)] gap-0 px-0',
        'icon-xs': 'size-[var(--button-height-sm)] gap-0 px-0',
        'icon-sm': 'size-[var(--button-height-sm)] gap-0 px-0',
        'icon-lg': 'size-[var(--button-height-lg)] gap-0 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = Omit<React.ComponentProps<'button'>, 'aria-busy'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingLabel?: string;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    loading = false,
    loadingLabel,
    disabled,
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      {...props}
      aria-busy={loading || undefined}
      aria-label={loadingLabel ?? props['aria-label']}
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : loading || disabled}
      aria-disabled={asChild && (loading || disabled) ? true : props['aria-disabled']}
      tabIndex={asChild && (loading || disabled) ? -1 : props.tabIndex}
      onClickCapture={(event) => {
        if (asChild && (loading || disabled)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        props.onClickCapture?.(event);
      }}
      className={cn(buttonVariants({ variant, size, className }))}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
      {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
    </Comp>
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
