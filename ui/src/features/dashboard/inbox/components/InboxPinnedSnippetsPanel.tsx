import { useEffect, useMemo, useState } from 'react';

import { Loader2, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  INBOX_PINNED_SNIPPETS_MAX,
  newInboxPinnedSnippetId,
  readInboxPinnedSnippets,
  type InboxPinnedSnippet,
} from '@/features/dashboard/inbox/lib/inboxPinnedSnippets';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useUpdateProperty } from '@/features/dashboard/org/hooks/useUpdateProperty';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';

function SnippetFormDialog({
  open,
  snippet,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  snippet: InboxPinnedSnippet | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (snippet: InboxPinnedSnippet) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(snippet?.title ?? '');
    setBodyText(snippet?.bodyText ?? '');
  }, [open, snippet]);

  const handleSave = async (): Promise<boolean> => {
    const trimmedTitle = title.trim();
    const trimmedBody = bodyText.trim();
    if (!trimmedTitle || !trimmedBody) {
      toast.error('Title and message required');
      return false;
    }
    return onSave({
      id: snippet?.id ?? newInboxPinnedSnippetId(),
      title: trimmedTitle,
      bodyText: trimmedBody,
    });
  };

  const initialTitle = snippet?.title ?? '';
  const initialBody = snippet?.bodyText ?? '';
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: title !== initialTitle || bodyText !== initialBody,
    onSave: handleSave,
    onDiscard: () => {
      setTitle(initialTitle);
      setBodyText(initialBody);
    },
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={snippet ? 'Edit pinned snippet' : 'New pinned snippet'}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),28rem)] sm:max-w-[min(90vw,36rem)]"
        contentClassName="z-[104]"
        footer={
          <>
            <Button type="button" variant="outline" disabled={saving} onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !title.trim() || !bodyText.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pinned-snippet-title">Title</Label>
            <Input
              id="pinned-snippet-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pinned-snippet-body">Message</Label>
            <Textarea
              id="pinned-snippet-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

/** Property-scoped saved snippets for the inbox Insert menu. */
export function InboxPinnedSnippetsPanel() {
  const orgContext = useOptionalOrgContext();
  const updateProperty = useUpdateProperty(orgContext?.orgSlug ?? '');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InboxPinnedSnippet | null>(null);

  const snippets = useMemo(
    () => readInboxPinnedSnippets(orgContext?.property.settings),
    [orgContext?.property.settings]
  );

  if (!orgContext?.property.id || !orgContext.orgSlug) return null;

  const propertyId = orgContext.property.id;

  const persist = async (next: InboxPinnedSnippet[]) => {
    await updateProperty.mutateAsync({
      propertyId,
      settings: { inboxPinnedSnippets: next },
    });
  };

  const handleSave = async (snippet: InboxPinnedSnippet): Promise<boolean> => {
    const exists = snippets.some((row) => row.id === snippet.id);
    const next = exists
      ? snippets.map((row) => (row.id === snippet.id ? snippet : row))
      : [...snippets, snippet];
    if (next.length > INBOX_PINNED_SNIPPETS_MAX) {
      toast.error(`Max ${INBOX_PINNED_SNIPPETS_MAX} pinned snippets`);
      return false;
    }
    try {
      await persist(next);
      toast.success(exists ? 'Updated' : 'Saved');
      setFormOpen(false);
      setEditing(null);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  const handleDelete = async (snippet: InboxPinnedSnippet) => {
    try {
      await persist(snippets.filter((row) => row.id !== snippet.id));
      toast.success('Deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="border-border shrink-0 border-b px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Pin className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <p className="text-sm font-semibold">Pinned snippets</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[36px]"
          disabled={snippets.length >= INBOX_PINNED_SNIPPETS_MAX || updateProperty.isPending}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>
      {snippets.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Save up to {INBOX_PINNED_SNIPPETS_MAX} property snippets for Insert.
        </p>
      ) : (
        <ul className="space-y-1">
          {snippets.map((snippet) => (
            <li
              key={snippet.id}
              className="hover:bg-muted/50 flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{snippet.title}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label={`Edit ${snippet.title}`}
                disabled={updateProperty.isPending}
                onClick={() => {
                  setEditing(snippet);
                  setFormOpen(true);
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive size-9 shrink-0"
                aria-label={`Delete ${snippet.title}`}
                disabled={updateProperty.isPending}
                onClick={() => void handleDelete(snippet)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <SnippetFormDialog
        open={formOpen}
        snippet={editing}
        saving={updateProperty.isPending}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
