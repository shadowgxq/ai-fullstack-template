import * as React from 'react'

import { cn } from '@/shared/utils/cn'

type TextareaProps = React.ComponentProps<'textarea'>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, readOnly, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      readOnly={readOnly}
      className={cn(
        'block min-h-[var(--textarea-min-height)] w-full min-w-0 resize-y rounded-[var(--radius-control)] border-[length:var(--control-border-width)] border-input bg-background p-[calc(var(--space-3)-var(--control-border-width))] text-[length:var(--font-size-md)] leading-[var(--control-leading)] text-foreground font-normal transition-[color,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_calc(var(--focus-ring-width)-var(--control-border-width))_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:shadow-none read-only:cursor-default read-only:bg-muted motion-reduce:transition-none',
        !readOnly && 'hover:border-border-strong',
        className,
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'

export { Textarea }
