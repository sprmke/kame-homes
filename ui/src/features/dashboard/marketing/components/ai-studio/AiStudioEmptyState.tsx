import { Clapperboard, ImageIcon, LayoutTemplate, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type AiStudioEmptyKind = 'post' | 'image' | 'video';

const COPY: Record<AiStudioEmptyKind, { icon: LucideIcon; title: string; body: string }> = {
  post: {
    icon: LayoutTemplate,
    title: 'Your posts show up here',
    body: 'Pick a goal and tap Generate posts. You get four designs made from your listing photos.',
  },
  image: {
    icon: ImageIcon,
    title: 'Your photos show up here',
    body: 'Describe a shot, add a few of your own photos so it looks like your place, then Generate.',
  },
  video: {
    icon: Clapperboard,
    title: 'Your videos show up here',
    body: 'Describe the motion and add up to three photos. Videos take a minute or two.',
  },
};

export function AiStudioEmptyState({
  kind,
  className,
}: {
  kind: AiStudioEmptyKind;
  className?: string;
}) {
  const { icon: Icon, title, body } = COPY[kind];
  return (
    <div
      className={cn(
        'border-border/60 flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center sm:min-h-[22rem]',
        className
      )}
    >
      <span className="bg-primary/10 text-primary mb-3 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">{body}</p>
    </div>
  );
}
