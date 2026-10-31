import { Pencil, Reply, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  mode: 'reply' | 'edit';
  preview: string;
  onClear: () => void;
  className?: string;
};

export function ChatComposerContextBar({ mode, preview, onClear, className }: Props) {
  const Icon = mode === 'edit' ? Pencil : Reply;
  const label = mode === 'edit' ? 'Editing' : 'Reply';

  return (
    <div className={cn('bg-muted/50 flex items-start gap-2 rounded-lg px-2.5 py-1.5', className)}>
      <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] font-medium leading-none">{label}</p>
        <p className="text-foreground mt-0.5 line-clamp-2 break-words text-xs leading-snug">
          {preview}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] shrink-0"
        onClick={onClear}
        aria-label={`Cancel ${label.toLowerCase()}`}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
