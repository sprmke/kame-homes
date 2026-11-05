import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { cn } from '@/lib/utils';

type Props = Extract<ChatBlock, { type: 'callout' }>;

const TONE: Record<Props['tone'], string> = {
  info: 'border-border bg-muted/40',
  warning: 'border-amber-500/40 bg-amber-500/10',
  success: 'border-primary/40 bg-primary/5',
};

export function CalloutBlock({ tone, text, href }: Props) {
  return (
    <div className={cn('rounded-xl border p-3 text-sm', TONE[tone])}>
      {href ? (
        <a href={href} className="underline-offset-2 hover:underline">
          {text}
        </a>
      ) : (
        text
      )}
    </div>
  );
}
