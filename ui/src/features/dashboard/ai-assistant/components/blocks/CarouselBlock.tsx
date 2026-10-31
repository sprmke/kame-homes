import { EntityCardBlock } from '@/features/dashboard/ai-assistant/components/blocks/EntityCardBlock';
import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

type Props = Extract<ChatBlock, { type: 'carousel' }> & {
  onRunAction?: (action: { label: string; prompt: string }) => void;
};

export function CarouselBlock({ title, items, onRunAction }: Props) {
  const cards = items ?? [];
  return (
    <div className="space-y-2" data-testid="assistant-carousel-block">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {cards.map((item) => (
          <div key={item.id || item.title} className="w-[min(100%,18rem)] shrink-0 snap-start">
            <EntityCardBlock {...item} onRunAction={onRunAction} />
          </div>
        ))}
      </div>
    </div>
  );
}
