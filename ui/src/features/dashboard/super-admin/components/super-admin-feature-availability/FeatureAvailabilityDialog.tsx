import * as React from 'react';

import { toast } from 'sonner';

import {
  isoToManilaDateTimeParts,
  isFutureIso,
  manilaDateTimeToIso,
} from '@/features/dashboard/super-admin/lib/featureAvailabilityAdmin';
import type { UpdateFeatureAvailabilityInput } from '@/features/dashboard/super-admin/hooks/useFeatureAvailabilityAdmin';

import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import {
  FEATURE_AVAILABILITY_REASONS,
  FEATURE_AVAILABILITY_REASON_COPY,
  type FeatureAvailabilityCatalogEntry,
  type FeatureAvailabilityReason,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';
import {
  featureAvailabilityReasonLabel,
  featureAvailabilityToneForReason,
  formatFeatureExpectedBackLabel,
  resolveFeatureAvailabilityMessage,
} from '@/lib/featureAvailability/featureAvailabilityCopy';

type Draft = {
  reason: FeatureAvailabilityReason;
  message: string;
  date: string;
  time: string;
  autoRestore: boolean;
  showBanner: boolean;
  superAdminBypass: boolean;
};

function defaultDraft(): Draft {
  return {
    reason: 'maintenance',
    message: '',
    date: '',
    time: '',
    autoRestore: false,
    showBanner: false,
    superAdminBypass: true,
  };
}

function draftFromOverride(
  override: {
    is_enabled: boolean;
    reason: string | null;
    message: string | null;
    expected_back_at: string | null;
    auto_restore: boolean;
    show_banner: boolean;
    super_admin_bypass: boolean;
  } | null
): Draft {
  if (!override || override.reason == null) return defaultDraft();
  const reason = FEATURE_AVAILABILITY_REASONS.includes(override.reason as FeatureAvailabilityReason)
    ? (override.reason as FeatureAvailabilityReason)
    : 'maintenance';
  const { date, time } = isoToManilaDateTimeParts(override.expected_back_at);
  return {
    reason,
    message: override.message ?? '',
    date,
    time,
    autoRestore: override.auto_restore,
    showBanner: override.show_banner,
    superAdminBypass: override.super_admin_bypass,
  };
}

function allowedReasons(entry: FeatureAvailabilityCatalogEntry): FeatureAvailabilityReason[] {
  return FEATURE_AVAILABILITY_REASONS.filter((reason) => {
    const copy = FEATURE_AVAILABILITY_REASON_COPY[reason];
    if (copy.requiresProvider && !entry.provider) return false;
    return true;
  });
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FeatureAvailabilityCatalogEntry;
  initialOverride: {
    is_enabled: boolean;
    reason: string | null;
    message: string | null;
    expected_back_at: string | null;
    auto_restore: boolean;
    show_banner: boolean;
    super_admin_bypass: boolean;
  } | null;
  onSave: (input: UpdateFeatureAvailabilityInput) => Promise<boolean>;
};

export function FeatureAvailabilityDialog({
  open,
  onOpenChange,
  entry,
  initialOverride,
  onSave,
}: Props) {
  const [draft, setDraft] = React.useState<Draft>(() => draftFromOverride(initialOverride));

  React.useEffect(() => {
    if (!open) return;
    setDraft(draftFromOverride(initialOverride));
  }, [open, initialOverride]);

  const reasons = allowedReasons(entry);

  React.useEffect(() => {
    if (reasons.includes(draft.reason)) return;
    setDraft((current) => ({ ...current, reason: reasons[0] ?? 'maintenance' }));
  }, [draft.reason, reasons]);

  const expectedBackAt =
    draft.date && draft.time ? manilaDateTimeToIso(draft.date, draft.time) : null;

  const previewMessage = resolveFeatureAvailabilityMessage({
    reason: draft.reason,
    customMessage: draft.message.trim() || null,
    sourceKey: entry.key,
  });
  const previewExpectedBack = formatFeatureExpectedBackLabel({
    expectedBackAt,
    serverSkewMs: 0,
  });

  const buildPayload = (): UpdateFeatureAvailabilityInput | { error: string } => {
    const message = draft.message.trim();
    if (draft.reason === 'other' && !message) {
      return { error: 'Add a short message when reason is Other.' };
    }
    if (message.length > 280) {
      return { error: 'Message must be 280 characters or fewer.' };
    }
    if (draft.autoRestore && !expectedBackAt) {
      return { error: 'Set an expected back time to use auto restore.' };
    }
    if (expectedBackAt && !isFutureIso(expectedBackAt)) {
      return { error: 'Expected back time must be in the future (Asia/Manila).' };
    }

    return {
      featureKey: entry.key,
      isEnabled: false,
      reason: draft.reason,
      message: message || null,
      expectedBackAt,
      autoRestore: draft.autoRestore,
      showBanner: draft.showBanner,
      superAdminBypass: draft.superAdminBypass,
    };
  };

  const handleSave = async (): Promise<boolean> => {
    const payload = buildPayload();
    if ('error' in payload) {
      toast.error(payload.error);
      return false;
    }
    return onSave(payload);
  };

  const baseline = draftFromOverride(initialOverride);
  const resetDraft = () => setDraft(baseline);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const editingExisting =
    initialOverride != null && initialOverride.reason != null && !initialOverride.is_enabled;
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({ open, onOpenChange, isDirty, onSave: handleSave, onDiscard: resetDraft });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          className="max-h-[min(90dvh,44rem)] max-w-2xl sm:max-w-2xl"
          sheetLayout="split"
        >
          <ResponsiveModalHeader className="shrink-0 px-4 sm:px-0">
            <ResponsiveModalTitle>
              {editingExisting ? `Edit ${entry.label}` : `Turn off ${entry.label}`}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-0">
            <div className="space-y-1">
              <Label htmlFor="fa-reason">Reason</Label>
              <Select
                value={draft.reason}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    reason: value as FeatureAvailabilityReason,
                  }))
                }
              >
                <SelectTrigger id="fa-reason" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {featureAvailabilityReasonLabel(reason)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="fa-message">Message</Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {draft.message.length}/280
                </span>
              </div>
              <Textarea
                id="fa-message"
                value={draft.message}
                maxLength={280}
                rows={3}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, message: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="fa-date">Expected back date</Label>
                <Input
                  id="fa-date"
                  type="date"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, date: event.target.value }))
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fa-time">Time (Manila)</Label>
                <Input
                  id="fa-time"
                  type="time"
                  value={draft.time}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, time: event.target.value }))
                  }
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <Label htmlFor="fa-auto-restore" className="font-normal">
                  Auto restore at expected time
                </Label>
                <Switch
                  id="fa-auto-restore"
                  checked={draft.autoRestore}
                  disabled={!expectedBackAt}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, autoRestore: checked }))
                  }
                />
              </div>
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <Label htmlFor="fa-banner" className="font-normal">
                  Show dashboard banner
                </Label>
                <Switch
                  id="fa-banner"
                  checked={draft.showBanner}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, showBanner: checked }))
                  }
                />
              </div>
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <Label htmlFor="fa-bypass" className="font-normal">
                  Super admin bypass
                </Label>
                <Switch
                  id="fa-bypass"
                  checked={draft.superAdminBypass}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, superAdminBypass: checked }))
                  }
                />
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg border p-2">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Preview
              </p>
              <FeatureUnavailablePanel
                compact
                label={entry.label}
                message={previewMessage}
                expectedBackLabel={previewExpectedBack}
                reason={draft.reason}
                tone={featureAvailabilityToneForReason(draft.reason)}
              />
            </div>
          </div>

          <ResponsiveModalFooter className="shrink-0 gap-2 px-4 sm:px-0">
            <Button type="button" variant="outline" onClick={() => requestClose()}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()}>
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
