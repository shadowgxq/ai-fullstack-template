import * as React from 'react';

import { cn } from '@/shared/utils/cn';

type SkeletonProps = React.ComponentProps<'span'>;

const Skeleton = React.forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { className, 'aria-hidden': ariaHidden = true, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="skeleton"
      aria-hidden={ariaHidden}
      className={cn(
        'bg-muted block animate-pulse rounded-[var(--radius-control)] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
});

Skeleton.displayName = 'Skeleton';

export { Skeleton };
