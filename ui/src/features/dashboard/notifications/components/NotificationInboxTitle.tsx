import { cn } from '@/lib/utils';

type Props = {
  name: string;
  platformLabel: string;
  nameClassName?: string;
};

/** Guest name with inline channel pill — toast, bell list, Activity. */
export function NotificationInboxTitle({ name, platformLabel, nameClassName }: Props) {
  return (
    <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      <span className={cn('truncate', nameClassName)}>{name}</span>
      <span className="bg-muted/80 text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none">
        {platformLabel}
      </span>
    </span>
  );
}
