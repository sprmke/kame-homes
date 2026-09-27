import * as React from 'react';

import { toast } from 'sonner';

import type { AiAssignTarget } from '@/features/dashboard/super-admin/components/super-admin-ai/AiAssignDialog';
import { AiLimitFields } from '@/features/dashboard/super-admin/components/super-admin-ai/AiLimitFields';
import { useAiLimitsAction } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';
import {
  draftToLimits,
  emptyDraft,
  limitsToDraft,
  ORG_OVERRIDE_KEYS,
  PROPERTY_OVERRIDE_KEYS,
  type AiLimitKey,
} from '@/features/dashboard/super-admin/lib/aiLimits';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type AiOverrideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'organization' | 'property';
  targets: AiAssignTarget[];
  /** Single target: current overrides, prefilled. Bulk: ignored (only filled fields are applied). */
  initial?: Partial<Record<AiLimitKey, number | null>>;
  onDone?: () => void;
};

/**
 * Overrides are the exception path. Single target: blank clears that override. Bulk: blank
 * fields are left untouched, and "Clear overrides" removes every override on the selection.
 */
export function AiOverrideDialog({
  open,
  onOpenChange,
  scope,
  targets,
  initial,
  onDone,
}: AiOverrideDialogProps) {
  const action = useAiLimitsAction();
  const keys = scope === 'organization' ? ORG_OVERRIDE_KEYS : PROPERTY_OVERRIDE_KEYS;
  const bulk = targets.length > 1;
  const [draft, setDraft] = React.useState(emptyDraft);
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setDraft(bulk || !initial ? emptyDraft() : limitsToDraft(initial));
    setReason('');
  }, [open, bulk, initial]);

  const label = bulk
    ? `${targets.length} ${scope === 'organization' ? 'organizations' : 'properties'}`
    : targets[0]?.name;

  const submit = async (
    limits: Partial<Record<AiLimitKey, number | null>>,
    successMessage: string
  ): Promise<boolean> => {
    try {
      await action.mutateAsync({
        action: 'set_overrides',
        scope,
        scopeIds: targets.map((target) => target.id),
        limits,
        reason: reason.trim() || null,
      });
      toast.success(successMessage);
      onOpenChange(false);
      onDone?.();
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save overrides'));
      return false;
    }
  };

  const handleSave = async (): Promise<boolean> => {
    const parsed = draftToLimits(draft, keys);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return false;
    }
    const limits = bulk
      ? Object.fromEntries(Object.entries(parsed.limits).filter(([, value]) => value !== null))
      : parsed.limits;
    if (Object.keys(limits).length === 0) {
      toast.error('Enter at least one limit');
      return false;
    }
    return submit(limits, 'Overrides saved');
  };

  const handleClear = () =>
    void submit(Object.fromEntries(keys.map((key) => [key, null])), 'Overrides cleared');

  const baselineDraft = bulk || !initial ? emptyDraft() : limitsToDraft(initial);
  const resetDraft = () => {
    setDraft(baselineDraft);
    setReason('');
  };
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baselineDraft) || reason !== '';
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({ open, onOpenChange, isDirty, onSave: handleSave, onDiscard: resetDraft });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent className="max-w-2xl" sheetLayout="split">
          <ResponsiveModalHeader className="px-4 sm:px-0">
            <ResponsiveModalTitle>Overrides for {label}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-0">
            <AiLimitFields
              idPrefix="ai-override"
              keys={keys}
              draft={draft}
              onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
              placeholders={
                bulk ? Object.fromEntries(keys.map((key) => [key, 'Unchanged'])) : undefined
              }
            />
            <div className="space-y-1">
              <Label htmlFor="ai-override-reason">Reason</Label>
              <Input
                id="ai-override-reason"
                value={reason}
                maxLength={200}
                onChange={(event) => setReason(event.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <ResponsiveModalFooter className="px-4 pb-4 sm:px-0 sm:pb-0">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={action.isPending}
            >
              Clear overrides
            </Button>
            <Button type="button" onClick={() => void handleSave()} loading={action.isPending}>
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
