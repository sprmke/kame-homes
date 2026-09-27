import { useEffect, useMemo, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  applyInboxQuickReplyMerge,
  buildSampleQuickReplyMergeContext,
  INBOX_QUICK_REPLY_MERGE_FIELDS,
} from '@/features/dashboard/inbox/lib/inboxQuickReplyMerge';
import {
  platformFromQuickReplyGroup,
  quickReplyGroupFromPlatform,
  QUICK_REPLY_ASSIGN_GROUPS,
  quickReplyGroupLabel,
  type QuickReplyGroup,
} from '@/features/dashboard/inbox/lib/quickReplyGroups';
import type {
  InboxTemplate,
  SaveInboxTemplatePayload,
} from '@/features/dashboard/inbox/types/inbox';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  template: InboxTemplate | null;
  defaultGroup: QuickReplyGroup;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SaveInboxTemplatePayload) => Promise<void>;
};

export function InboxQuickReplyFormDialog({
  open,
  template,
  defaultGroup,
  saving,
  onOpenChange,
  onSave,
}: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [group, setGroup] = useState<QuickReplyGroup>('all');

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? '');
    setBody(template?.body_text ?? '');
    setGroup(template ? quickReplyGroupFromPlatform(template.platform) : defaultGroup);
  }, [open, template, defaultGroup]);

  const { canUse: canUseQuickReplies, isLoading: quickRepliesLoading } =
    useFeatureGate('quickReplies');
  const { open: openUpgradeModal } = useUpgradeModal();

  const previewText = useMemo(() => {
    const trimmed = body.trim();
    if (!trimmed) return '';
    const hasMergeField = INBOX_QUICK_REPLY_MERGE_FIELDS.some((field) => trimmed.includes(field));
    const hasUrl = /https?:\/\//i.test(trimmed);
    if (!hasMergeField && !hasUrl) return '';
    return applyInboxQuickReplyMerge(trimmed, buildSampleQuickReplyMergeContext());
  }, [body]);

  const handleSubmit = async (): Promise<boolean> => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message required');
      return false;
    }
    if (!canUseQuickReplies) {
      if (!quickRepliesLoading) openUpgradeModal('quickReplies');
      return false;
    }
    try {
      await onSave({
        id: template?.id,
        title: title.trim(),
        bodyText: body.trim(),
        platform: platformFromQuickReplyGroup(group),
      });
      toast.success(template ? 'Updated' : 'Saved');
      onOpenChange(false);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  const initialGroup = template ? quickReplyGroupFromPlatform(template.platform) : defaultGroup;
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty:
      title !== (template?.title ?? '') ||
      body !== (template?.body_text ?? '') ||
      group !== initialGroup,
    onSave: handleSubmit,
    onDiscard: () => {
      setTitle(template?.title ?? '');
      setBody(template?.body_text ?? '');
      setGroup(initialGroup);
    },
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title={template ? 'Edit reply' : 'New reply'}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),28rem)] sm:max-w-[min(90vw,36rem)]"
        contentClassName="z-[103]"
        overlayClassName="z-[102]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] sm:min-h-10"
              disabled={saving}
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] sm:min-h-10"
              disabled={saving || !title.trim() || !body.trim()}
              onClick={() => void handleSubmit()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inbox-qr-form-title">Title</Label>
            <Input
              id="inbox-qr-form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Availability check"
              className="h-10"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inbox-qr-form-body">Message</Label>
            <Textarea
              id="inbox-qr-form-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Thanks for reaching out! Please share your dates…"
              className="min-h-[140px] resize-none font-normal"
            />
            <p className="text-muted-foreground text-xs">
              Placeholders: {INBOX_QUICK_REPLY_MERGE_FIELDS.join(', ')}
            </p>
            {previewText ? (
              <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                  Preview
                </p>
                <p className="text-foreground whitespace-pre-wrap text-sm">{previewText}</p>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Group</Label>
            <div
              className="border-border bg-muted/30 flex overflow-x-auto rounded-lg border p-1"
              role="group"
              aria-label="Quick reply group"
            >
              {QUICK_REPLY_ASSIGN_GROUPS.map((option) => {
                const active = group === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGroup(option)}
                    className={cn(
                      'flex min-h-[44px] flex-1 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors sm:text-sm',
                      active
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {quickReplyGroupLabel(option)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
