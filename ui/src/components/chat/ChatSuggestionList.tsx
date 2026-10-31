import { HelpCircle, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ChatSuggestionItem = {
  id: string;
  prompt: string;
  Icon?: LucideIcon;
};

type Props = {
  suggestions: ChatSuggestionItem[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
  Icon?: LucideIcon;
};

export function ChatSuggestionList({
  suggestions,
  onPick,
  disabled,
  Icon: DefaultIcon = HelpCircle,
}: Props) {
  const items = suggestions.filter((item) => item.prompt.trim().length > 0);
  if (items.length === 0) return null;

  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {items.map((item, index) => {
        const prompt = item.prompt.trim();
        const Icon = item.Icon ?? DefaultIcon;
        return (
          <li
            key={item.id}
            className="min-w-0 motion-safe:animate-[slideUp_0.38s_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              className={cn(
                'surface-card native-press focus-visible:ring-ring group flex min-h-[44px] w-full min-w-0 items-center gap-3 px-3 py-3 text-left text-sm',
                'transition-[background-color,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none',
                '[@media(hover:hover)]:hover:bg-muted/50 lg:[@media(hover:hover)]:hover:border-primary/20 lg:[@media(hover:hover)]:hover:shadow-card-hover',
                'dark:lg:[@media(hover:hover)]:hover:border-[hsl(0_0%_100%_/_0.08)]',
                'focus-visible:outline-none focus-visible:ring-2',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <span className="bg-primary/12 text-primary [@media(hover:hover)]:group-hover:bg-primary/18 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-pretty leading-snug [overflow-wrap:anywhere]">
                {prompt}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
