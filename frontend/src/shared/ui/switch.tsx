import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/shared/utils/cn'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      className={cn(
        'group/switch inline-flex h-[var(--control-hit-size)] w-[var(--switch-track-width)] shrink-0 touch-manipulation items-center justify-center bg-transparent p-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[calc(var(--disabled-opacity-percent)/100)]',
        className,
      )}
      {...props}
    >
      {/* The real 44px hit area contains the 24px track; focus follows the track. */}
      <span
        data-slot="switch-track"
        className="pointer-events-none flex h-[var(--switch-track-height)] w-full items-center rounded-[var(--radius-pill)] border-[length:var(--control-border-width)] border-transparent bg-input p-[calc(var(--space-0-5)-var(--control-border-width))] transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-data-[state=checked]/switch:bg-primary group-data-[state=checked]/switch:group-hover/switch:bg-primary-hover group-data-[state=unchecked]/switch:group-hover/switch:bg-border-strong group-focus-visible/switch:ring-[length:var(--focus-ring-width)] group-focus-visible/switch:ring-ring group-focus-visible/switch:ring-offset-[length:var(--space-0-5)] group-focus-visible/switch:ring-offset-background motion-reduce:transition-none"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="block size-[var(--switch-thumb-size)] shrink-0 rounded-[var(--radius-pill)] bg-background transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] data-[state=checked]:translate-x-[var(--switch-thumb-offset)] motion-reduce:transition-none"
        />
      </span>
    </SwitchPrimitive.Root>
  )
})

Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
