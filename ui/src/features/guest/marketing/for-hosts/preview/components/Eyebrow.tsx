import { cn } from '@/lib/utils';

/**
 * Section marker for the redesigned host page: a short teal rule and a sentence-case label.
 * Replaces the old all-caps, wide-tracked eyebrows.
 */
export function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn('text-primary flex items-center gap-3 text-sm font-semibold', className)}>
      <span aria-hidden className="bg-primary h-px w-6" />
      {children}
    </p>
  );
}
