import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function SuperAdminBypassPill({ className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300',
        className
      )}
    >
      Off for hosts
    </span>
  );
}
