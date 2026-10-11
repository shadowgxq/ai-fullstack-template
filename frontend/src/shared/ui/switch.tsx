import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/shared/utils/cn'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
    /** Kept for source compatibility; geometry is intentionally one contract. */
    size?: 'sm' | 'default' | 'lg'
  }
>(function Switch({ className, size = 'default', ...props }, ref) {

  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer relative inline-flex h-[var(--switch-track-height)] w-[var(--switch-track-width)] shrink-0 touch-manipulation items-center rounded-[var(--radius-pill)] border-[length:var(--control-border-width)] border-transparent bg-input p-[calc(var(--space-0-5)-var(--control-border-width))] outline-none transition-[background-color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] after:absolute after:inset-x-0 after:top-1/2 after:h-[var(--control-hit-size)] after:-translate-y-1/2 after:content-[\'\'] focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-offset-[length:var(--focus-ring-offset)] focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:hover:bg-primary-hover data-[state=unchecked]:hover:bg-border-strong data-disabled:cursor-not-allowed data-disabled:opacity-[var(--disabled-opacity)] motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[var(--switch-thumb-size)] rounded-[var(--radius-pill)] bg-background shadow-[var(--elevation-sm)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] data-[state=checked]:translate-x-[var(--switch-thumb-offset)] motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  )
})

Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
