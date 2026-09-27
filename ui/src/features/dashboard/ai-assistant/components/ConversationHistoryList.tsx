import { useMemo, useState } from 'react';

import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Loader2, MessageCircle, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAiAssistantConversations,
  useDeleteAiAssistantConversation,
} from '@/features/dashboard/ai-assistant/hooks/useAiAssistantConversations';
import type { AiAssistantConversationSummary } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { displayConversationTitle } from '@/features/dashboard/ai-assistant/lib/conversationTitle';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onDeleted: (conversationId: string) => void;
};

type DayGroup = {
  key: string;
  label: string;
  rows: AiAssistantConversationSummary[];
};

function dayGroup(iso: string): { key: string; label: string } {
  const date = new Date(iso);
  if (isToday(date)) return { key: 'today', label: 'Today' };
  if (isYesterday(date)) return { key: 'yesterday', label: 'Yesterday' };
  return { key: format(date, 'yyyy-MM-dd'), label: format(date, 'MMMM d, yyyy') };
}

function groupByDay(rows: AiAssistantConversationSummary[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const row of rows) {
    const { key, label } = dayGroup(row.last_message_at);
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      map.set(key, { key, label, rows: [row] });
    }
  }
  return [...map.values()];
}

export function ConversationHistoryList({ activeConversationId, onSelect, onDeleted }: Props) {
  const { conversations, isLoading, isError } = useAiAssistantConversations(true);
  const deleteConversation = useDeleteAiAssistantConversation();
  const [q, setQ] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return conversations;
    return conversations.filter((row) => {
      const raw = (row.title ?? '').toLowerCase();
      const display = displayConversationTitle(row.title).toLowerCase();
      return raw.includes(needle) || display.includes(needle);
    });
  }, [conversations, needle]);
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        setPendingDeleteId(null);
        onDeleted(id);
      },
      onError: () => {
        toast.error("Couldn't delete conversation.");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-hidden p-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-muted-foreground flex min-h-0 min-w-0 flex-1 items-center justify-center px-6 text-center text-sm">
        Couldn&apos;t load past conversations.
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
        <MessageCircle className="h-6 w-6" aria-hidden />
        <p>No past conversations yet.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-border/60 relative shrink-0 border-b p-2">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          aria-label="Search conversations"
          className="h-10 ps-9"
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground px-2 py-8 text-center text-sm">No conversations</p>
        ) : (
          grouped.map((group) => (
            <section key={group.key} className="mt-1 first:mt-0">
              <h3 className="text-muted-foreground bg-card sticky top-0 z-[1] px-2 py-1.5 text-xs font-medium">
                {group.label}
              </h3>
              <ul className="flex min-w-0 flex-col gap-1.5">
                {group.rows.map((conversation) => {
                  const title = displayConversationTitle(conversation.title);
                  const isActive = conversation.id === activeConversationId;
                  const isDeleting =
                    deleteConversation.isPending &&
                    deleteConversation.variables === conversation.id;

                  return (
                    <li key={conversation.id} className="min-w-0">
                      <div
                        className={cn(
                          'surface-card native-press group flex min-w-0 items-center gap-0.5',
                          'transition-[background-color,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none',
                          !isActive && '[@media(hover:hover)]:hover:bg-muted/50',
                          'lg:[@media(hover:hover)]:hover:border-primary/20 lg:[@media(hover:hover)]:hover:shadow-card-hover',
                          'dark:lg:[@media(hover:hover)]:hover:border-[hsl(0_0%_100%_/_0.08)]',
                          isActive && 'bg-primary/10 ring-primary/20 ring-1'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(conversation.id)}
                          aria-current={isActive ? 'true' : undefined}
                          className="focus-visible:ring-ring flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-start gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                        >
                          <span className="bg-primary/12 text-primary [@media(hover:hover)]:group-hover:bg-primary/18 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none">
                            <MessageCircle className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              title={conversation.title ?? title}
                              className="line-clamp-2 text-sm font-medium leading-snug [overflow-wrap:anywhere]"
                            >
                              {title}
                            </span>
                            <span className="text-muted-foreground mt-0.5 block text-xs">
                              {formatDistanceToNow(new Date(conversation.last_message_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isDeleting}
                          className="text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px] shrink-0"
                          aria-label="Delete conversation"
                          onClick={() => setPendingDeleteId(conversation.id)}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deleteConversation.isPending) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent
          overlayClassName="z-[60]"
          className="z-[60] max-w-[min(calc(100vw-1.5rem),24rem)]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConversation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConversation.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
