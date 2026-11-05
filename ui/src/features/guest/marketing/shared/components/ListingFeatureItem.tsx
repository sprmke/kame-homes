import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function ListingFeatureItem({ icon: Icon, title, description }: Props) {
  return (
    <div className="@md:gap-4 flex min-w-0 gap-3">
      <div className="shrink-0">
        <Icon className="text-foreground @md:h-6 @md:w-6 h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-foreground text-[15px] font-medium md:text-base">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}
