import { useState } from 'react';

import { Brain } from 'lucide-react';

import { AssistantMemoryDialog } from '@/features/dashboard/ai-assistant/components/AssistantMemoryDialog';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = { className?: string; iconClassName?: string };

/** Header button that opens the assistant Memory dialog (preferences + house style). */
export function AssistantMemoryButton({ className, iconClassName }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('min-h-[44px] min-w-[44px] shrink-0', className)}
        onClick={() => setOpen(true)}
        aria-label="Memory"
        title="Memory"
      >
        <Brain className={cn('size-4', iconClassName)} aria-hidden />
      </Button>
      <AssistantMemoryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
