import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { FieldLabel } from '@/components/forms/FieldLabel';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';

export const DEFAULT_AI_RESPONSE_CONTEXT =
  'Be warm and concise (1–3 sentences per reply).\n' +
  'Double-check dates, pricing, and policies against our property info before answering.\n' +
  "If you're not sure about something, let the guest know you'll follow up.";

const MAX_LENGTH = 2000;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiSystemPrompt: string;
  saving: boolean;
  onSave: (value: string) => Promise<void>;
};

export function InboxAiResponseDialog({
  open,
  onOpenChange,
  aiSystemPrompt,
  saving,
  onSave,
}: Props) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) setDraft(aiSystemPrompt);
  }, [open, aiSystemPrompt]);

  const handleSave = async (): Promise<boolean> => {
    try {
      await onSave(draft.trim());
      toast.success('Saved');
      onOpenChange(false);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: draft.trim() !== aiSystemPrompt.trim(),
    onSave: handleSave,
    onDiscard: () => setDraft(aiSystemPrompt),
  });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="z-[103] flex max-h-[min(92dvh,640px)] max-w-[min(calc(100vw-1.5rem),36rem)] flex-col overflow-hidden sm:max-w-[min(90vw,36rem)]"
          overlayClassName="z-[102]"
        >
          <ResponsiveModalHeader className="shrink-0 max-lg:px-4">
            <ResponsiveModalTitle>Manage AI response</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-1 max-lg:px-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel
                  htmlFor="inbox-ai-context-body"
                  label="Tone & rules"
                  help="Property details, rates, availability, booking info, and your Quick replies are already used automatically. No need to repeat them here. Use this box for tone or extra guidance the AI should follow when answering guests."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 min-h-[44px] px-2 text-xs sm:min-h-8"
                  disabled={saving}
                  onClick={() => setDraft(DEFAULT_AI_RESPONSE_CONTEXT)}
                >
                  Reset to default
                </Button>
              </div>
              <Textarea
                id="inbox-ai-context-body"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="Example: Mention we're pet-friendly with prior approval. Early check-in may be possible if the unit is ready. Just ask."
                className="min-h-[180px] resize-none font-normal"
                maxLength={MAX_LENGTH}
              />
              <p className="text-muted-foreground text-right text-xs">
                {draft.length}/{MAX_LENGTH}
              </p>
            </div>
          </div>

          <ResponsiveModalFooter className="shrink-0 gap-2 max-lg:px-4 sm:gap-2">
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
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
