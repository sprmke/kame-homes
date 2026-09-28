import { useState } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAddAssistantMemory,
  useAssistantMemory,
  useDeleteAssistantMemory,
} from '@/features/dashboard/ai-assistant/hooks/useAssistantMemory';
import type { AssistantMemoryItem } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

const CONTENT_MAX = 300;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function MemoryList({
  items,
  canDelete,
  emptyText,
}: {
  items: AssistantMemoryItem[];
  canDelete: boolean;
  emptyText: string;
}) {
  const remove = useDeleteAssistantMemory();
  if (items.length === 0) {
    return <p className="text-muted-foreground py-2 text-sm">{emptyText}</p>;
  }
  return (
    <ul className="divide-border/60 divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-2 py-1">
          <p className="min-w-0 flex-1 break-words text-sm">{item.content}</p>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-9 min-h-[36px] min-w-[36px] shrink-0"
              aria-label={`Forget "${item.content}"`}
              onClick={() =>
                remove.mutate(item.id, {
                  onError: (err) => toast.error(friendlyToastError(err, "Couldn't remove it")),
                })
              }
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AddMemoryField({
  label,
  placeholder,
  value,
  onChange,
  onAdd,
  busy,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  busy: boolean;
}) {
  return (
    <form
      className="flex gap-2 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd();
      }}
    >
      <Input
        value={value}
        maxLength={CONTENT_MAX}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 min-w-0 flex-1"
      />
      <Button type="submit" className="min-h-[40px] shrink-0" disabled={busy || !value.trim()}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Add'}
      </Button>
    </form>
  );
}

/**
 * What the assistant remembers: the host's own preferences and the org house style
 * (editable by members with the AI assistant settings permission). Shared by both surfaces.
 */
export function AssistantMemoryDialog({ open, onOpenChange }: Props) {
  const memory = useAssistantMemory(open);
  const add = useAddAssistantMemory();
  const [preferenceDraft, setPreferenceDraft] = useState('');
  const [styleDraft, setStyleDraft] = useState('');
  const dirty = Boolean(preferenceDraft.trim() || styleDraft.trim());

  const save = async (kind: 'preference' | 'house_style', content: string) => {
    try {
      await add.mutateAsync({ kind, content: content.trim() });
      if (kind === 'preference') setPreferenceDraft('');
      else setStyleDraft('');
      return true;
    } catch (err) {
      toast.error(friendlyToastError(err, "Couldn't save it"));
      return false;
    }
  };

  const guard = useGuardedClose({
    open,
    onOpenChange,
    isDirty: dirty,
    onSave: async () => {
      if (preferenceDraft.trim() && !(await save('preference', preferenceDraft))) return false;
      if (styleDraft.trim() && !(await save('house_style', styleDraft))) return false;
      return true;
    },
    onDiscard: () => {
      setPreferenceDraft('');
      setStyleDraft('');
    },
  });

  const data = memory.data;
  const savingKind = add.isPending ? add.variables?.kind : null;

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guard.onOpenChange}
        title="Memory"
        bodyClassName="space-y-5"
        footer={
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={guard.requestClose}
          >
            Done
          </Button>
        }
      >
        {memory.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ) : memory.isError ? (
          <p className="text-muted-foreground text-sm">Couldn&apos;t load memory.</p>
        ) : data ? (
          <>
            <section aria-label="Your preferences">
              <h3 className="text-card-title text-foreground">Your preferences</h3>
              <MemoryList items={data.preferences} canDelete emptyText="Nothing saved yet" />
              <AddMemoryField
                label="New preference"
                placeholder="Always show amounts in pesos"
                value={preferenceDraft}
                onChange={setPreferenceDraft}
                onAdd={() => void save('preference', preferenceDraft)}
                busy={savingKind === 'preference'}
              />
            </section>
            <section aria-label="House style">
              <h3 className="text-card-title text-foreground">House style</h3>
              <MemoryList
                items={data.houseStyle}
                canDelete={data.canManageHouseStyle}
                emptyText="No house style yet"
              />
              {data.canManageHouseStyle ? (
                <AddMemoryField
                  label="New house style rule"
                  placeholder="Sign guest replies as The Kame team"
                  value={styleDraft}
                  onChange={setStyleDraft}
                  onAdd={() => void save('house_style', styleDraft)}
                  busy={savingKind === 'house_style'}
                />
              ) : null}
            </section>
          </>
        ) : null}
      </AdminDialogShell>
      <UnsavedChangesDialog {...guard.dialogProps} />
    </>
  );
}
