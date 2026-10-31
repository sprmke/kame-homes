import { cn } from '@/lib/utils';

type Props = {
  name: string | null | undefined;
  className?: string;
};

/** Property name chip for org-scoped booking list views. */
export function BookingPropertyLabel({ name, className }: Props) {
  if (!name?.trim()) return null;
  return (
    <p className={cn('text-caption text-muted-foreground truncate', className)} title={name}>
      {name}
    </p>
  );
}
