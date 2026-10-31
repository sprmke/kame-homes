import { useMemo, useState } from 'react';

import { Check, Copy, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  enrichPlaceholderLines,
  filterPlaceholders,
  groupPlaceholders,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';

import { cn } from '@/lib/utils';

type Props = {
  lines: string[];
  className?: string;
  /** Optional preview sample values — fills e.g. when metadata is missing. */
  sampleVars?: Record<string, string>;
  /** Copy + insert into the active editor; parent may close the modal. */
  onInsertToken?: (token: string) => void;
};

export function TelegramPlaceholdersReference({
  lines,
  className,
  sampleVars,
  onInsertToken,
}: Props) {
  const [query, setQuery] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const enriched = useMemo(() => enrichPlaceholderLines(lines, sampleVars), [lines, sampleVars]);
  const filtered = useMemo(() => filterPlaceholders(enriched, query), [enriched, query]);
  const groups = useMemo(() => groupPlaceholders(filtered), [filtered]);

  async function writeClipboard(token: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(token);
      return true;
    } catch {
      toast.error('Could not copy to clipboard');
      return false;
    }
  }

  async function copyOnly(token: string) {
    if (!(await writeClipboard(token))) return;
    setCopiedToken(token);
    toast.success('Copied');
    window.setTimeout(() => {
      setCopiedToken((current) => (current === token ? null : current));
    }, 1600);
  }

  async function insertToken(token: string) {
    if (!(await writeClipboard(token))) return;
    if (onInsertToken) {
      onInsertToken(token);
      toast.success('Placeholder added');
      return;
    }
    toast.success('Copied');
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      <p className="text-muted-foreground text-[10px] leading-snug sm:text-[11px]">
        Tap to insert. Filled from live booking data on send.
      </p>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens…"
          aria-label="Search placeholders"
          className={cn(
            'border-border/70 bg-card text-foreground h-9 w-full rounded-lg border py-1.5 pl-8 pr-2.5 text-xs',
            'placeholder:text-muted-foreground/70 shadow-[inset_0_1px_2px_hsl(240_6%_10%_/0.04)]',
            'field-focus transition-colors',
            'dark:border-border/50 dark:bg-muted/30 dark:shadow-none'
          )}
        />
      </div>

      {groups.length === 0 ? (
        <p className="border-border/70 bg-muted/20 text-muted-foreground rounded-lg border border-dashed px-2.5 py-3 text-center text-[10px] sm:text-[11px]">
          {query.trim() ? 'No tokens match your search.' : 'No placeholders for this template.'}
        </p>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {groups.map(({ group, items }) => (
            <section key={group} aria-label={group} className="surface-card p-3 sm:p-4">
              <h3 className="text-muted-foreground mb-2 text-[10px] font-bold uppercase tracking-wider">
                {group}
              </h3>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {items.map((item) => {
                  const copied = copiedToken === item.token;
                  return (
                    <li key={item.token}>
                      <div
                        className={cn(
                          'flex w-full items-start gap-1 rounded-lg transition-colors',
                          'hover:bg-muted/40'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void insertToken(item.token)}
                          className={cn(
                            'min-w-0 flex-1 px-2 py-2 text-left',
                            'focus-visible:ring-ring/30 focus-visible:outline-none focus-visible:ring-2'
                          )}
                        >
                          <code className="text-primary block break-all font-mono text-[10px] font-semibold sm:text-[11px]">
                            {item.token}
                          </code>
                          <span className="text-muted-foreground mt-0.5 block text-[10px] leading-snug sm:text-[11px]">
                            {item.description}
                          </span>
                          <span className="text-muted-foreground/75 mt-0.5 block truncate text-[10px] leading-snug sm:text-[11px]">
                            e.g. {item.example}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Copy ${item.token}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyOnly(item.token);
                          }}
                          className={cn(
                            'text-muted-foreground flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2',
                            'hover:bg-muted/60 hover:text-foreground',
                            'focus-visible:ring-ring/30 focus-visible:outline-none focus-visible:ring-2'
                          )}
                        >
                          {copied ? (
                            <Check className="text-primary size-3.5" aria-hidden />
                          ) : (
                            <Copy className="size-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
