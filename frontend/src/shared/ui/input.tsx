import * as React from 'react';

import { cn } from '@/shared/utils/cn';

export type InputSize = 'sm' | 'md' | 'lg';

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: InputSize;
};

const INPUT_SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'h-[var(--input-height-sm)]',
  md: 'h-[var(--input-height-md)]',
  lg: 'h-[var(--input-height-lg)]',
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, size = 'md', readOnly, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      data-size={size}
      readOnly={readOnly}
      className={cn(
        'w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--control-border-width)] border-input bg-background px-[var(--input-padding-x)] text-[length:var(--font-size-md)] leading-[var(--line-height-md)] text-foreground transition-[color,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none file:inline-flex file:h-[var(--icon-size-lg)] file:border-0 file:bg-transparent file:text-[length:var(--font-size-md)] file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-border-strong focus-visible:[--tw-ring-width:var(--control-focus-stroke)] focus-visible:[--tw-ring-offset-width:var(--focus-ring-offset)] focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-[var(--disabled-opacity)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:[--tw-ring-width:var(--control-focus-stroke)] aria-invalid:ring-destructive/30 read-only:cursor-default read-only:bg-muted motion-reduce:transition-none',
        INPUT_SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export { Input };
