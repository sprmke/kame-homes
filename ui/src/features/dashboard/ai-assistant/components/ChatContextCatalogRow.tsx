import type { ReactNode } from 'react';

import { ChatContextCatalogRowVisual } from '@/features/dashboard/ai-assistant/components/ChatContextCatalogRowVisual';
import type { AssistantCatalogEntry } from '@/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog';

import { cn } from '@/lib/utils';

type Props = {
  entry: AssistantCatalogEntry;
  selected: boolean;
  onSelect?: () => void;
  trailing?: ReactNode;
  interactive?: boolean;
};

function CatalogRowContent({
  entry,
  selected,
  trailing,
}: Pick<Props, 'entry' | 'selected' | 'trailing'>) {
  return (
    <>
      <ChatContextCatalogRowVisual visual={entry.visual} />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">
          {entry.item.label}
        </span>
        {entry.subtitle || entry.meta ? (
          <span className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
            {entry.subtitle ? <span className="truncate">{entry.subtitle}</span> : null}
            {entry.subtitle && entry.meta ? (
              <span className="text-border shrink-0" aria-hidden>
                ·
              </span>
            ) : null}
            {entry.meta ? (
              <span
                className={cn(
                  'truncate',
                  entry.metaTone === 'primary' && 'text-primary font-medium'
                )}
              >
                {entry.meta}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      {trailing}
      {selected ? (
        <span className="bg-primary ms-0.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
      ) : null}
    </>
  );
}

export function ChatContextCatalogRow({
  entry,
  selected,
  onSelect,
  trailing,
  interactive = true,
}: Props) {
  const className = cn(
    'flex min-h-[52px] w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left',
    interactive &&
      'native-press focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
    selected ? 'bg-primary/10' : interactive ? 'hover:bg-muted/60' : undefined
  );

  if (!interactive) {
    return (
      <div className={className}>
        <CatalogRowContent entry={entry} selected={selected} trailing={trailing} />
      </div>
    );
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={className}
    >
      <CatalogRowContent entry={entry} selected={selected} trailing={trailing} />
    </button>
  );
}

export function ChatContextLoadMoreRow({
  remaining,
  onClick,
}: {
  remaining: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'native-press focus-visible:ring-ring text-primary flex min-h-[44px] w-full items-center justify-center rounded-lg px-2 text-sm font-medium',
        'hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2'
      )}
    >
      Load {Math.min(remaining, 12)} more
    </button>
  );
}
