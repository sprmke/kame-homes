import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  value: string | number;
  label: string;
};

export function ListingStatItem({ icon: Icon, value, label }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <div className="bg-muted shrink-0 rounded-full p-1.5 md:p-2.5">
        <Icon className="text-muted-foreground size-4 md:size-5" aria-hidden />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
        <p className="text-foreground text-[15px] font-semibold tabular-nums md:text-base">
          {value}
        </p>
        <p className="text-muted-foreground text-[13px] md:text-sm">{label}</p>
      </div>
    </div>
  );
}
