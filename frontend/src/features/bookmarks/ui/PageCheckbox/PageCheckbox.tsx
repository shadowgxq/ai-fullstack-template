import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../../../shared/utils/cn';

type PageCheckboxProps = {
  label: string;
  checked: boolean;
  isIndeterminate?: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
};

export function PageCheckbox({
  label,
  checked,
  isIndeterminate = false,
  disabled,
  onChange,
  children,
}: PageCheckboxProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);
  return (
    <label
      className={cn(
        'flex min-h-[var(--control-hit-size)] min-w-[var(--control-hit-size)] items-center gap-[var(--space-3)]',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <input
        ref={input}
        type="checkbox"
        aria-label={label}
        aria-checked={isIndeterminate ? 'mixed' : checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-[var(--space-4)] shrink-0 accent-[var(--primary)] focus-visible:ring-[length:var(--focus-ring-width)] focus-visible:ring-ring focus-visible:outline-none disabled:opacity-[var(--disabled-opacity)]"
      />
      {children}
    </label>
  );
}
