import * as React from 'react'
import { Label as LabelPrimitive } from 'radix-ui'

import { cn } from '@/shared/utils/cn'

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn(
        'flex items-center gap-[var(--space-2)] text-[length:var(--font-size-md)] leading-[var(--label-leading)] font-medium text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-[calc(var(--disabled-opacity-percent)/100)] peer-disabled:cursor-not-allowed peer-disabled:opacity-[calc(var(--disabled-opacity-percent)/100)]',
        className,
      )}
      {...props}
    />
  )
})

Label.displayName = LabelPrimitive.Root.displayName

export { Label }
