import * as React from 'react'

import { cn } from '@/shared/utils/cn'

export type TextareaSize = 'sm' | 'md' | 'lg'

type TextareaProps = Omit<React.ComponentProps<'textarea'>, 'size'> & {
  size?: TextareaSize
}

const TEXTAREA_SIZE_CLASSES: Record<TextareaSize, string> = {
  sm: 'min-h-[var(--input-height-sm)]',
  md: 'min-h-[var(--textarea-min-height)]',
  lg: 'min-h-[var(--input-height-lg)]',
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, size = 'md', readOnly, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      data-size={size}
      readOnly={readOnly}
      className={cn(
        'w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-[var(--control-border-width)] border-input bg-background px-[var(--input-padding-x)] py-[var(--space-3)] text-[var(--font-size-md)] leading-[var(--line-height-md)] text-foreground transition-[color,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none placeholder:text-muted-foreground hover:border-border-strong focus-visible:[--tw-ring-width:var(--control-focus-stroke)] focus-visible:[--tw-ring-offset-width:var(--focus-ring-offset)] focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-[var(--disabled-opacity)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:[--tw-ring-width:var(--control-focus-stroke)] aria-invalid:ring-destructive/30 read-only:cursor-default read-only:bg-muted motion-reduce:transition-none',
        TEXTAREA_SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'

export { Textarea }
