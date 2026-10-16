import * as React from 'react'

import { cn } from '@/shared/utils/cn'

type InputProps = React.ComponentProps<'input'>

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, readOnly, ...props },
  ref,
) {
  // 用内阴影补足加粗描边，保持边框盒与文字起点不随焦点/校验状态移动。
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      readOnly={readOnly}
      className={cn(
        'block h-[var(--input-height-md)] w-full min-w-0 rounded-[var(--radius-control)] border-[length:var(--control-border-width)] border-input bg-background px-[calc(var(--space-3)-var(--control-border-width))] text-[length:var(--font-size-md)] leading-[var(--control-leading)] text-foreground font-normal transition-[color,background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none file:inline-flex file:h-[var(--icon-size-lg)] file:border-0 file:bg-transparent file:text-[length:var(--font-size-md)] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_calc(var(--focus-ring-width)-var(--control-border-width))_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-[calc(var(--disabled-opacity-percent)/100)] aria-invalid:border-[var(--control-invalid-border)] aria-invalid:shadow-[inset_0_0_0_calc(var(--focus-ring-width)-var(--control-border-width))_var(--control-invalid-border)] read-only:cursor-default read-only:bg-muted motion-reduce:transition-none',
        !readOnly && 'hover:border-border-strong',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export { Input }
