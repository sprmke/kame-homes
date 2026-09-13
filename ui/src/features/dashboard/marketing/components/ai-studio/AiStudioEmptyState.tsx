import { Sparkles } from 'lucide-react';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';

export function AiStudioEmptyState() {
  return (
    <FloatingPanel
      padding="lg"
      className="border-border/50 flex min-h-[16rem] flex-col items-center justify-center border border-dashed py-12 text-center sm:min-h-[22rem]"
    >
      <div className="bg-primary/10 mb-4 flex size-12 items-center justify-center rounded-full">
        <Sparkles className="text-primary size-5" aria-hidden />
      </div>
      <p className="text-foreground text-sm font-semibold">Ready to generate</p>
    </FloatingPanel>
  );
}
