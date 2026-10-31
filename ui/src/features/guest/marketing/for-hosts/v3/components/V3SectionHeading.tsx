import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';

import { cn } from '@/lib/utils';

/** Eyebrow + title (+ optional lead) used by every v3 section so headings share one scale. */
export function V3SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      <h2 className="text-foreground mt-3 text-balance text-3xl font-bold tracking-[-0.025em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            'text-muted-foreground mt-4 max-w-lg leading-relaxed sm:text-lg',
            align === 'center' && 'mx-auto'
          )}
        >
          {lead}
        </p>
      ) : null}
    </Reveal>
  );
}
