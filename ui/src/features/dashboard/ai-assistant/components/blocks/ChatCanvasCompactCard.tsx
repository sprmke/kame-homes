import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  canvasBlockSummary,
  canvasBlockTitle,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';

import { Button } from '@/components/ui/button';

type Props = {
  block: ChatBlock;
  onOpen: () => void;
};

export function ChatCanvasCompactCard({ block, onOpen }: Props) {
  const title = canvasBlockTitle(block);
  const summary = canvasBlockSummary(block);

  return (
    <div className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-3">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      {summary ? <p className="text-muted-foreground text-xs">{summary}</p> : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full sm:w-auto"
        onClick={onOpen}
        aria-label="Open in canvas"
      >
        Open
      </Button>
    </div>
  );
}
