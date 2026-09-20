import { useId, type PropsWithChildren } from 'react';

type DemoSectionProps = PropsWithChildren<{ title: string }>;
export function DemoSection({ title, children }: DemoSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 space-y-5 rounded-xl border border-border-subtle bg-card p-5 sm:p-6"
    >
      <h2 id={headingId} className="font-mono text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
