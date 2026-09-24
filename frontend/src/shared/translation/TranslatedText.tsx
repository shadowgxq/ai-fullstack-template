import { memo } from 'react';

import { Skeleton } from '@/shared/ui/skeleton';

import { cn } from '../utils/cn';
import type { PageTranslationController } from './translation.types';

export type TranslatedTextProps = Readonly<{
  translations: PageTranslationController;
  sourceText?: string | null;
  loadingLabel: string;
  skeletonLines?: 1 | 2 | 3;
  className?: string;
  formatText?: (value: string) => string | null | undefined;
}>;

export const TranslatedText = memo(function TranslatedText({
  translations,
  sourceText,
  loadingLabel,
  skeletonLines = 1,
  className,
  formatText,
}: TranslatedTextProps) {
  const field = translations.resolve(sourceText);
  if (field.status !== 'loading') {
    const displayText = field.text == null ? null : (formatText?.(field.text) ?? field.text);
    return (
      <span className={className} data-translation-state={field.status}>
        {displayText}
      </span>
    );
  }

  return (
    <span
      className={cn('grid w-full gap-[var(--space-2)] py-[var(--space-0-5)]', className)}
      data-translation-state="loading"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      {Array.from({ length: skeletonLines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            'h-[1em]',
            index === skeletonLines - 1 && skeletonLines > 1 ? 'w-3/5' : 'w-full',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
});
