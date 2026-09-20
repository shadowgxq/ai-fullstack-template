import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';

import { cn } from '@/shared/utils/cn';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn(
        'flex items-center gap-[var(--space-2)] text-[var(--label-font-size)] leading-[var(--label-line-height)] font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-[var(--disabled-opacity)] peer-disabled:cursor-not-allowed peer-disabled:opacity-[var(--disabled-opacity)]',
        className,
      )}
      {...props}
    />
  );
});

Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
