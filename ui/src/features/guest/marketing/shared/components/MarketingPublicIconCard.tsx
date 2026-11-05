import type { LucideIcon } from 'lucide-react';

interface MarketingPublicIconCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  action?: string;
}

export function MarketingPublicIconCard({
  icon: Icon,
  title,
  body,
  href,
  action,
}: MarketingPublicIconCardProps) {
  return (
    <article className="border-border bg-card public-card-pad flex h-full flex-col rounded-2xl border">
      <div className="public-icon-well bg-primary/10 text-primary mb-3 md:mb-4">
        <Icon className="size-[18px] md:size-5" aria-hidden />
      </div>
      <h3 className="public-card-title text-foreground font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1.5 flex-1 text-sm leading-relaxed">{body}</p>
      {href && action ? (
        <a
          href={href}
          className="text-primary relative mt-3 inline-flex items-center self-start py-1 text-sm font-semibold before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] hover:underline md:mt-4"
        >
          {action}
        </a>
      ) : null}
    </article>
  );
}
