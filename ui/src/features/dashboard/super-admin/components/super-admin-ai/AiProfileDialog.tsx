import * as React from 'react';

import { toast } from 'sonner';

import { AiLimitFields } from '@/features/dashboard/super-admin/components/super-admin-ai/AiLimitFields';
import {
  useAiLimitsAction,
  type AiLimitProfile,
  type AiLimitProfileUsage,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';
import {
  AI_LIMIT_KEYS,
  draftToLimits,
  emptyDraft,
  limitsToDraft,
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

type AiProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create. */
  profile: (AiLimitProfile & { usage: AiLimitProfileUsage }) | null;
};

export function AiProfileDialog({ open, onOpenChange, profile }: AiProfileDialogProps) {
  const action = useAiLimitsAction();
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [draft, setDraft] = React.useState(emptyDraft);

  React.useEffect(() => {
    if (!open) return;
    setCode(profile?.code ?? '');
    setName(profile?.name ?? '');
    setDescription(profile?.description ?? '');
    setDraft(profile ? limitsToDraft(profile.limits) : emptyDraft());
  }, [open, profile]);

  const handleSave = async (): Promise<boolean> => {
    const parsed = draftToLimits(draft, AI_LIMIT_KEYS);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return false;
    }
    const base = {
      name: name.trim(),
      description: description.trim() || null,
      limits: parsed.limits,
    };
    const request = profile
      ? ({ action: 'update_profile', profileId: profile.id, ...base } as const)
      : ({ action: 'create_profile', code: code.trim(), ...base } as const);
    try {
      await action.mutateAsync(request);
      toast.success(profile ? 'Profile saved' : 'Profile created');
      onOpenChange(false);
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save profile'));
      return false;
    }
  };

  const baselineDraft = profile ? limitsToDraft(profile.limits) : emptyDraft();
  const resetDraft = () => {
    setCode(profile?.code ?? '');
    setName(profile?.name ?? '');
    setDescription(profile?.description ?? '');
    setDraft(baselineDraft);
  };
  const isDirty =
    code !== (profile?.code ?? '') ||
    name !== (profile?.name ?? '') ||
    description !== (profile?.description ?? '') ||
    JSON.stringify(draft) !== JSON.stringify(baselineDraft);
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({ open, onOpenChange, isDirty, onSave: handleSave, onDiscard: resetDraft });

  const setLimit = (key: AiLimitKey, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent className="max-w-2xl" sheetLayout="split">
          <ResponsiveModalHeader className="px-4 sm:px-0">
            <ResponsiveModalTitle>
              {profile ? `Edit ${profile.name}` : 'New profile'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-0">
            {profile ? (
              <p className="text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 text-sm">
                Applies to {profile.usage.affectedOrganizations}{' '}
                {profile.usage.affectedOrganizations === 1 ? 'organization' : 'organizations'}, $
                {profile.usage.spend30dUsd.toLocaleString('en-US')} spent in the last 30 days.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ai-profile-code">Code</Label>
                <Input
                  id="ai-profile-code"
                  value={code}
                  disabled={Boolean(profile)}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="growth"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-profile-name">Name</Label>
                <Input
                  id="ai-profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-profile-description">Description</Label>
              <Input
                id="ai-profile-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-10"
              />
            </div>

            <AiLimitFields
              idPrefix="ai-profile"
              keys={AI_LIMIT_KEYS}
              draft={draft}
              onChange={setLimit}
            />
          </div>

          <ResponsiveModalFooter className="px-4 pb-4 sm:px-0 sm:pb-0">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
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
