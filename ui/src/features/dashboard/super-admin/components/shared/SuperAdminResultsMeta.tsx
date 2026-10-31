import { cn } from '@/lib/utils';

type Props = {
  visibleCount: number;
  totalCount: number;
  className?: string;
};

export function SuperAdminResultsMeta({ visibleCount, totalCount, className }: Props) {
  if (totalCount === 0) return null;
  return (
    <p className={cn('text-muted-foreground text-xs sm:text-sm', className)}>
      Showing {visibleCount} of {totalCount}
    </p>
  );
}
