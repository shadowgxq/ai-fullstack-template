import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { LoaderCircle } from 'lucide-react'

import { cn } from '@/shared/utils/cn'

const buttonVariants = cva(
  'group/button inline-flex max-w-full touch-manipulation shrink-0 items-center justify-center rounded-[var(--radius-control)] border-[length:var(--control-border-width)] border-transparent text-[length:var(--font-size-md)] leading-[var(--control-leading)] font-medium whitespace-normal text-center [overflow-wrap:anywhere] transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none select-none focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-offset-[length:var(--space-0-5)] focus-visible:ring-ring focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] aria-busy:opacity-100 data-disabled:aria-busy:opacity-100 aria-invalid:border-[var(--control-invalid-border)] motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-[var(--icon-size-md)]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        outline:
          'border-border bg-background text-foreground hover:border-border-strong hover:bg-surface-hover active:bg-surface-selected',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:bg-muted active:bg-surface-selected',
        ghost:
          'bg-transparent text-foreground hover:bg-surface-hover active:bg-surface-selected',
        destructive:
          'border-destructive bg-destructive-subtle text-destructive hover:border-destructive/60 active:border-destructive focus-visible:ring-destructive',
        link: 'border-0 !h-auto !min-h-0 !px-0 !py-0 bg-transparent text-foreground underline underline-offset-[var(--space-1)] hover:text-foreground active:translate-y-0',
      },
      // Canvas strokes are inset; keep the fill on the border box and compensate CSS padding.
      size: {
        sm: 'min-h-[var(--button-height-sm)] gap-[var(--space-2)] px-[calc(var(--space-3)-var(--control-border-width))] py-[calc(var(--space-3)/2-var(--control-border-width))]',
        default:
          'min-h-[var(--button-height-md)] gap-[var(--space-2)] px-[calc(var(--button-padding-x-md)-var(--control-border-width))] py-[calc(var(--space-2)-var(--control-border-width))]',
        lg: 'min-h-[var(--button-height-lg)] gap-[var(--space-2)] px-[calc(var(--space-6)-var(--control-border-width))] py-[calc(var(--space-3)-var(--control-border-width))]',
        icon: 'size-[var(--button-height-md)] gap-0 px-0',
        'icon-sm': 'size-[var(--button-height-sm)] gap-0 px-0',
        'icon-lg': 'size-[var(--button-height-lg)] gap-0 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = Omit<React.ComponentProps<'button'>, 'aria-busy'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingLabel?: string
  }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      loading = false,
      loadingLabel,
      disabled,
      onClickCapture,
      onKeyDownCapture,
      tabIndex,
      children,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot.Root : 'button'
    const isDisabled = Boolean(loading || disabled)

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        {...props}
        data-disabled={isDisabled || undefined}
        aria-disabled={asChild && isDisabled ? true : props['aria-disabled']}
        tabIndex={asChild && isDisabled ? -1 : tabIndex}
        onClickCapture={(event) => {
          if (isDisabled) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          onClickCapture?.(event)
        }}
        onKeyDownCapture={(event) => {
          if (isDisabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          onKeyDownCapture?.(event)
        }}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingLabel ?? props['aria-label'] : props['aria-label']}
        disabled={isDisabled}
        className={cn(buttonVariants({ variant, size, className }))}
      >
        {loading ? <LoaderCircle className={cn('animate-spin', variant === 'link' && 'text-primary')} aria-hidden="true" /> : null}
        {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
        {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </Comp>
    )
  },
)

Button.displayName = 'Button'

export { Button, buttonVariants }
