import { useMemo, useState } from 'react';

import { MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { InboxQuickReplyFormDialog } from '@/features/dashboard/inbox/components/InboxQuickReplyFormDialog';
import { QuickReplyGroupFilters } from '@/features/dashboard/inbox/components/QuickReplyGroupTabs';
import {
  defaultQuickReplyGroupForTab,
  quickReplyGroupLabel,
  templateMatchesQuickReplyTab,
  type QuickReplyGroupTab,
} from '@/features/dashboard/inbox/lib/quickReplyGroups';
import type {
  InboxTemplate,
  SaveInboxTemplatePayload,
} from '@/features/dashboard/inbox/types/inbox';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  templates: InboxTemplate[];
  isLoading: boolean;
  saving: boolean;
  onSave: (payload: SaveInboxTemplatePayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function InboxQuickRepliesTab({ templates, isLoading, saving, onSave, onDelete }: Props) {
  const [groupTab, setGroupTab] = useState<QuickReplyGroupTab>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InboxTemplate | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...templates]
      .filter((t) => templateMatchesQuickReplyTab(t, groupTab))
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    if (!q) return rows;
    return rows.filter(
      (t) => t.title.toLowerCase().includes(q) || t.body_text.toLowerCase().includes(q)
    );
  }, [templates, search, groupTab]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (template: InboxTemplate) => {
    setEditing(template);
    setFormOpen(true);
  };

  const handleDelete = async (template: InboxTemplate) => {
    try {
      await onDelete(template.id);
      toast.success('Deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const emptyLabel =
    search.trim() !== ''
      ? 'No replies match your search'
      : groupTab === 'all'
        ? 'No quick replies yet'
        : `No ${quickReplyGroupLabel(groupTab).toLowerCase()} replies yet`;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search replies"
            className="h-10 pl-9"
            aria-label="Search quick replies"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-3 w-16" aria-hidden />
            ) : (
              <p className="text-muted-foreground shrink-0 text-xs">
                {`${filtered.length} ${filtered.length === 1 ? 'reply' : 'replies'}`}
              </p>
            )}
            <QuickReplyGroupFilters value={groupTab} onChange={setGroupTab} />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 min-h-[44px] shrink-0 gap-1.5 sm:min-h-9"
            onClick={openCreate}
          >
            <Plus className="size-4" aria-hidden />
            New reply
          </Button>
        </div>

        <div className="border-border min-h-[min(50dvh,420px)] flex-1 overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="divide-border divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
              <MessageSquare className="text-muted-foreground/50 size-8" aria-hidden />
              <p className="text-muted-foreground mt-3 text-sm">{emptyLabel}</p>
              {!search.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 min-h-[44px]"
                  onClick={openCreate}
                >
                  New reply
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {filtered.map((template) => (
                <li key={template.id}>
                  <div className="group flex items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
                    <button
                      type="button"
                      className="hover:bg-muted/40 -mx-1 min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition-colors"
                      onClick={() => openEdit(template)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{template.title}</p>
                        {groupTab === 'all' && template.platform && (
                          <Badge variant="outline" className="px-2 py-0 font-medium">
                            {quickReplyGroupLabel(
                              template.platform === 'facebook' || template.platform === 'instagram'
                                ? template.platform
                                : 'all'
                            )}
                          </Badge>
                        )}
                        {groupTab === 'all' && !template.platform && (
                          <Badge variant="secondary" className="px-2 py-0 font-medium">
                            All
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">
                        {template.body_text}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 min-h-[44px] min-w-[44px]"
                        aria-label={`Edit ${template.title}`}
                        onClick={() => openEdit(template)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive size-10 min-h-[44px] min-w-[44px]"
                        aria-label={`Delete ${template.title}`}
                        onClick={() => void handleDelete(template)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <InboxQuickReplyFormDialog
        open={formOpen}
        template={editing}
        defaultGroup={defaultQuickReplyGroupForTab(groupTab)}
        saving={saving}
        onOpenChange={setFormOpen}
        onSave={onSave}
      />
    </>
  );
}
