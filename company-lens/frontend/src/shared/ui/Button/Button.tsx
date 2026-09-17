import * as Slot from '@radix-ui/react-slot';
import clsx from 'clsx';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'icon';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children: ReactNode;
  isPending?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  asChild = false,
  children,
  className,
  disabled = false,
  isPending = false,
  size = 'medium',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const rootClassName = clsx(styles.root, styles[variant], styles[size], className);

  if (asChild) {
    return (
      <Slot.Slot className={rootClassName} data-pending={isPending || undefined} {...props}>
        {children}
      </Slot.Slot>
    );
  }

  return (
    <button
      {...props}
      type={type}
      className={rootClassName}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
    >
      {isPending ? <LoaderCircle className={styles.spinner} size={17} aria-hidden /> : null}
      {children}
    </button>
  );
}
