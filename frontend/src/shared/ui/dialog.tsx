'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-[var(--overlay)] duration-[var(--duration-normal)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:duration-0',
        className,
      )}
      {...props}
    />
  )
})

DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export type DialogSize = 'sm' | 'md' | 'lg'
export type DialogContentVariant = 'default' | 'flush'
export type DialogType = 'default' | 'warning' | 'danger'

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  overlayClassName?: string
  size?: DialogSize
  type?: DialogType
  variant?: DialogContentVariant
  closeLabel?: string
}

const DIALOG_SIZE_CLASSES: Record<DialogSize, string> = {
  sm: 'max-w-[var(--dialog-width-sm)]',
  md: 'max-w-[var(--dialog-width-md)]',
  lg: 'max-w-[var(--dialog-width-lg)]',
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  {
    className,
    children,
    showCloseButton = true,
    overlayClassName,
    size = 'md',
    type = 'default',
    variant = 'default',
    closeLabel = 'Close',
    ...props
  },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        data-close-button={showCloseButton || undefined}
        data-size={size}
        data-dialog-type={type}
        data-variant={variant}
        className={cn(
          'group/dialog fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-var(--space-8))] overflow-y-auto w-[calc(100%-var(--space-8))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-surface)] border-[length:var(--control-border-width)] border-border-subtle bg-popover text-[length:var(--font-size-md)] leading-[var(--body-leading)] text-popover-foreground outline-none duration-[var(--duration-normal)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:duration-0',
          variant === 'flush'
            ? 'flex flex-col gap-0 overflow-hidden p-0'
            : 'grid gap-[var(--space-5)] p-[calc(var(--space-6)-var(--control-border-width))]',
          DIALOG_SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-[calc(var(--space-5)-var(--control-border-width))] right-[calc(var(--space-4)-var(--control-border-width))] after:absolute after:-inset-[calc((var(--control-hit-size)-var(--button-height-sm))/2)] after:content-['']"
              aria-label={closeLabel}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})

DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-[var(--space-5)]', className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-body" className={cn('min-w-0', className)} {...props} />
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-[var(--space-2)] border-t border-border-subtle pt-[calc(var(--space-4)-var(--control-border-width))] sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      ) : null}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'font-sans text-[length:var(--font-size-lg)] leading-[var(--large-text-leading)] font-semibold group-data-[close-button=true]/dialog:pr-[calc(var(--icon-size-md)+var(--space-4))]',
        className,
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-[length:var(--font-size-md)] leading-[var(--body-leading)] text-muted-foreground *:[a]:underline *:[a]:underline-offset-[var(--space-3)] *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
