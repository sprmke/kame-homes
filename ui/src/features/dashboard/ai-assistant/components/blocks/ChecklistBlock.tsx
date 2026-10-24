import { Check } from 'lucide-react';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { cn } from '@/lib/utils';

type Props = Extract<ChatBlock, { type: 'checklist' }> & {
  onRunAction?: (action: { label: string; prompt: string }) => void;
};

export function ChecklistBlock({ title, items, onRunAction }: Props) {
  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <ul className="space-y-1">
        {(items ?? []).map((item) => (
          <li key={item.id || item.label}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left text-sm"
              disabled={!item.prompt}
              onClick={() =>
                item.prompt && onRunAction?.({ label: item.label, prompt: item.prompt })
              }
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full border',
                  item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                )}
                aria-hidden
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>
              <span
                className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
