import type { ReactNode } from 'react';

import { composerSuggestionOptionId } from '@/features/dashboard/ai-assistant/lib/composerTriggers';

import { cn } from '@/lib/utils';

export type ComposerSuggestion = {
  key: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
};

type Props = {
  id: string;
  label: string;
  items: ComposerSuggestion[];
  activeIndex: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
  loading?: boolean;
  emptyText?: string;
};

/**
 * Inline listbox above the composer for `/` commands and `@` mentions. Focus stays in the
 * textarea (aria-activedescendant); mouse down is prevented so a click never blurs it.
 */
export function ComposerSuggestionMenu({
  id,
  label,
  items,
  activeIndex,
  onPick,
  onHover,
  loading = false,
  emptyText = 'No matches',
}: Props) {
  return (
    <div
      className="border-border/60 bg-popover shadow-elevated-lg absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-xl border"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ul
        id={id}
        role="listbox"
        aria-label={label}
        className="max-h-[min(18rem,40dvh)] overflow-y-auto p-1"
      >
        {loading && items.length === 0 ? (
          <li className="text-muted-foreground px-3 py-2.5 text-sm">Loading…</li>
        ) : items.length === 0 ? (
          <li className="text-muted-foreground px-3 py-2.5 text-sm">{emptyText}</li>
        ) : (
          items.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={item.key}
                id={composerSuggestionOptionId(id, index)}
                role="option"
                aria-selected={active}
                onClick={() => onPick(index)}
                onMouseMove={() => onHover(index)}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                  active ? 'bg-muted text-foreground' : 'text-foreground'
                )}
              >
                {item.icon ? (
                  <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center">
                    {item.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate font-medium" title={item.label}>
                  {item.label}
                </span>
                {item.hint ? (
                  <span className="text-muted-foreground min-w-0 shrink truncate text-xs">
                    {item.hint}
                  </span>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
