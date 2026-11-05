import { useState } from 'react';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { Button } from '@/components/ui/button';

type Props = Extract<ChatBlock, { type: 'timeline' }>;

export function TimelineBlock({ title, items }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 6);
  const extra = items.length - visible.length;

  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <ol className="space-y-3">
        {visible.map((item, index) => (
          <li key={`${item.at}-${index}`} className="flex gap-3">
            <span className="bg-border mt-1.5 size-2 shrink-0 rounded-full" aria-hidden />
            <div className="min-w-0">
              <p className="text-foreground text-sm">{item.label}</p>
              {item.detail ? <p className="text-muted-foreground text-xs">{item.detail}</p> : null}
              <p className="text-muted-foreground text-[11px]">
                {[item.actor, item.at].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {extra > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => setExpanded(true)}
        >
          Show {extra} more
        </Button>
      ) : null}
    </div>
  );
}
