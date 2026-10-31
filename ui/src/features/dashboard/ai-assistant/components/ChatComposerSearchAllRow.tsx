import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  onClick: () => void;
};

export function ChatComposerSearchAllRow({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'native-press focus-visible:ring-ring text-foreground flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-sm',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      Search all modules…
    </button>
  );
}
