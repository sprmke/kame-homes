import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { InlineRichText } from '@/components/chat/ChatRichBody';

type Props = Extract<ChatBlock, { type: 'stat_list' }>;

export function StatListBlock({ title, items }: Props) {
  const visibleItems = (items ?? []).filter((item) => item.label?.trim() && item.value?.trim());
  if (visibleItems.length === 0) return null;

  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      {title && <p className="text-foreground text-sm font-semibold">{title}</p>}
      <dl className="grid grid-cols-2 gap-2">
        {visibleItems.map((item) => (
          <div key={item.label} className="space-y-0.5">
            <dt className="text-muted-foreground text-xs">
              <InlineRichText text={item.label} />
            </dt>
            <dd className="text-foreground text-sm font-semibold tabular-nums">
              <InlineRichText text={item.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
