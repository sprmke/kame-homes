import { useMemo, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Archive, Loader2, MessageCircle, Pencil, Pin, PinOff, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAiAssistantConversations,
  useDeleteAiAssistantConversation,
  useUpdateAiAssistantConversation,
} from '@/features/dashboard/ai-assistant/hooks/useAiAssistantConversations';
import type { AiAssistantConversationSummary } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { groupConversations } from '@/features/dashboard/ai-assistant/lib/conversationGroups';
import { displayConversationTitle } from '@/features/dashboard/ai-assistant/lib/conversationTitle';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

type Props = {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onDeleted: (conversationId: string) => void;
  /** `rail`: compact rows for the AI mode side rail; `sheet`: card rows in the sheet. */
  variant?: 'sheet' | 'rail';
};

const TITLE_MAX = 80;

export function ConversationHistoryList({
  activeConversationId,
  onSelect,
  onDeleted,
  variant = 'sheet',
}: Props) {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 250);
  const {
    conversations,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
  } = useAiAssistantConversations(true, { q: debouncedQ });
  const deleteConversation = useDeleteAiAssistantConversation();
  const updateConversation = useUpdateAiAssistantConversation();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const groups = useMemo(() => groupConversations(conversations), [conversations]);
  const rail = variant === 'rail';
  const searching = debouncedQ.trim().length > 0;

  const update = (
    conversationId: string,
    patch: { title?: string; pinned?: boolean; archived?: boolean },
    failure: string
  ) => {
    updateConversation.mutate({ conversationId, patch }, { onError: () => toast.error(failure) });
  };

  const commitRename = (row: AiAssistantConversationSummary) => {
    const title = renameValue.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
    setRenamingId(null);
    if (!title || title === row.title) return;
    update(row.id, { title }, "Couldn't rename conversation");
  };

  const archive = (row: AiAssistantConversationSummary) => {
    update(row.id, { archived: true }, "Couldn't archive conversation");
    if (row.id === activeConversationId) onDeleted(row.id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        setPendingDeleteId(null);
        onDeleted(id);
      },
      onError: () => toast.error("Couldn't delete conversation"),
    });
  };

  const searchBox = (
    <div className={cn('relative shrink-0', rail ? 'px-2 pb-2' : 'border-border/60 border-b p-2')}>
      <Search
        className={cn(
          'text-muted-foreground pointer-events-none absolute top-1/2 size-4 -translate-y-1/2',
          rail ? 'start-4' : 'start-4'
        )}
        aria-hidden
      />
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search"
        aria-label="Search conversations"
        className={cn('ps-9', rail ? 'h-9' : 'h-10')}
      />
      {isFetching && searching ? (
        <Loader2
          className="text-muted-foreground absolute end-4 top-1/2 size-4 -translate-y-1/2 animate-spin"
          aria-hidden
        />
      ) : null}
    </div>
  );

  let body;
  if (isLoading) {
    body = (
      <div className="space-y-2 p-2" aria-busy="true" aria-label="Loading conversations">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={cn('w-full rounded-lg', rail ? 'h-9' : 'h-16 rounded-xl')} />
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <p className="text-muted-foreground px-4 py-8 text-center text-sm">
        Couldn&apos;t load conversations.
      </p>
    );
  } else if (conversations.length === 0) {
    body = searching ? (
      <p className="text-muted-foreground px-4 py-8 text-center text-sm">No conversations</p>
    ) : (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm">
        <MessageCircle className="size-6" aria-hidden />
        <p>No conversations yet</p>
      </div>
    );
  } else {
    body = (
      <div className="p-2">
        {groups.map((group) => (
          <section key={group.key} className="mt-2 first:mt-0" aria-label={group.label}>
            <h3
              className={cn(
                'text-muted-foreground sticky top-0 z-[1] px-2 py-1.5 text-xs font-medium',
                rail ? 'bg-sidebar' : 'bg-card'
              )}
            >
              {group.label}
            </h3>
            <ul className={cn('flex min-w-0 flex-col', rail ? 'gap-0.5' : 'gap-1.5')}>
              {group.rows.map((row) => {
                const title = displayConversationTitle(row.title);
                const isActive = row.id === activeConversationId;
                const isDeleting =
                  deleteConversation.isPending && deleteConversation.variables === row.id;

                if (renamingId === row.id) {
                  return (
                    <li key={row.id} className="px-1">
                      <Input
                        autoFocus
                        value={renameValue}
                        maxLength={TITLE_MAX}
                        aria-label="Conversation name"
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => commitRename(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitRename(row);
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        className="h-9"
                      />
                    </li>
                  );
                }

                return (
                  <li key={row.id} className="min-w-0">
                    <div
                      className={cn(
                        'group relative min-w-0 overflow-hidden rounded-lg transition-colors duration-150 motion-reduce:transition-none',
                        !rail && 'surface-card native-press',
                        isActive
                          ? 'bg-primary/10 ring-primary/20 ring-1'
                          : '[@media(hover:hover)]:hover:bg-muted/60'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(row.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={cn(
                          'focus-visible:ring-ring flex w-full min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                          rail ? 'min-h-[40px] px-2 py-1.5' : 'min-h-[44px] px-3 py-2.5',
                          !isDeleting &&
                            '[@media(hover:hover)]:group-hover:pe-8 [@media(hover:none)]:pe-8'
                        )}
                      >
                        {!rail ? (
                          <span className="bg-primary/12 text-primary inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                            <MessageCircle className="size-4" aria-hidden />
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span
                            title={row.title ?? title}
                            className={cn(
                              'block truncate text-sm',
                              rail ? 'font-normal' : 'font-medium'
                            )}
                          >
                            {title}
                          </span>
                          {!rail ? (
                            <span className="text-muted-foreground mt-0.5 block text-xs">
                              {formatDistanceToNow(new Date(row.last_message_at), {
                                addSuffix: true,
                              })}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      {isDeleting ? (
                        <Loader2
                          className="text-muted-foreground absolute end-2 top-1/2 size-4 -translate-y-1/2 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <div
                          className={cn(
                            'absolute inset-y-0 end-0 z-[1] flex items-center rounded-e-lg pe-0.5',
                            '[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0',
                            '[@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100',
                            '[@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100',
                            '[@media(hover:hover)]:group-hover:bg-gradient-to-l [@media(hover:hover)]:group-hover:to-transparent [@media(hover:hover)]:group-hover:ps-4',
                            isActive
                              ? '[@media(hover:hover)]:group-hover:from-primary/10 [@media(hover:hover)]:group-hover:via-primary/10'
                              : '[@media(hover:hover)]:group-hover:from-muted/60 [@media(hover:hover)]:group-hover:via-muted/60'
                          )}
                        >
                          <ResponsiveOverflowMenu
                            label={`Actions for ${title}`}
                            sheetTitle={title}
                            triggerClassName="rounded-e-lg rounded-s-md hover:bg-transparent"
                            actionGroups={[
                              [
                                {
                                  key: 'rename',
                                  label: 'Rename',
                                  icon: <Pencil className="size-4" aria-hidden />,
                                  onSelect: () => {
                                    setRenameValue(row.title ?? '');
                                    setRenamingId(row.id);
                                  },
                                },
                                {
                                  key: 'pin',
                                  label: row.pinned_at ? 'Unpin' : 'Pin',
                                  icon: row.pinned_at ? (
                                    <PinOff className="size-4" aria-hidden />
                                  ) : (
                                    <Pin className="size-4" aria-hidden />
                                  ),
                                  onSelect: () =>
                                    update(
                                      row.id,
                                      { pinned: !row.pinned_at },
                                      "Couldn't update conversation"
                                    ),
                                },
                                {
                                  key: 'archive',
                                  label: 'Archive',
                                  icon: <Archive className="size-4" aria-hidden />,
                                  onSelect: () => archive(row),
                                },
                              ],
                              [
                                {
                                  key: 'delete',
                                  label: 'Delete',
                                  destructive: true,
                                  icon: <Trash2 className="size-4" aria-hidden />,
                                  onSelect: () => setPendingDeleteId(row.id),
                                },
                              ],
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {hasNextPage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground mt-2 min-h-[40px] w-full"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              'Load more'
            )}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {searchBox}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{body}</div>

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
