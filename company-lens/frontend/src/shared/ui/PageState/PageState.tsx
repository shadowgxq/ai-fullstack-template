import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './PageState.module.css';

export type PageStateTone = 'neutral' | 'danger';

export type PageStateProps = {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  tone?: PageStateTone;
};

export function PageState({
  action,
  className,
  description,
  icon,
  title,
  tone = 'neutral',
}: PageStateProps) {
  return (
    <section className={clsx(styles.root, className)} data-tone={tone} role="status">
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.description}>{description}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  );
}
