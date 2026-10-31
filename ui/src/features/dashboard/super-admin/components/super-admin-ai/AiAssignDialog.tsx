import * as React from 'react';

import { toast } from 'sonner';

import { useAiLimitsAction } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';

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
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

const NONE = '__none__';

export type AiAssignTarget = { id: string; name: string };

type AiAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'organization' | 'property' | 'development';
  targets: AiAssignTarget[];
  profiles: Array<{ id: string; code: string; name: string }>;
  currentProfileId?: string | null;
  onDone?: () => void;
};

/** Assign (or remove) one profile on one or many tenants in a single write. */
export function AiAssignDialog({
  open,
  onOpenChange,
  scope,
  targets,
  profiles,
  currentProfileId,
  onDone,
}: AiAssignDialogProps) {
  const action = useAiLimitsAction();
  const [profileId, setProfileId] = React.useState<string>(NONE);
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setProfileId(currentProfileId ?? NONE);
    setNote('');
  }, [open, currentProfileId]);

  const label = targets.length === 1 ? targets[0]?.name : `${targets.length} ${scope}s`;

  const handleSave = async (): Promise<boolean> => {
    try {
      await action.mutateAsync({
        action: 'assign',
        scope,
        scopeIds: targets.map((target) => target.id),
        profileId: profileId === NONE ? null : profileId,
        note: note.trim() || null,
      });
      toast.success(profileId === NONE ? 'Profile removed' : 'Profile assigned');
      onOpenChange(false);
      onDone?.();
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not assign profile'));
      return false;
    }
  };

  const resetDraft = () => {
    setProfileId(currentProfileId ?? NONE);
    setNote('');
  };
  const isDirty = profileId !== (currentProfileId ?? NONE) || note !== '';
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({ open, onOpenChange, isDirty, onSave: handleSave, onDiscard: resetDraft });

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent className="max-w-md">
          <ResponsiveModalHeader className="px-4 sm:px-0">
            <ResponsiveModalTitle>Assign profile to {label}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="space-y-4 px-4 pb-4 sm:px-0">
            <div className="space-y-1">
              <Label htmlFor="ai-assign-profile">Profile</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger id="ai-assign-profile" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No profile (inherit)</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-assign-note">Note</Label>
              <Input
                id="ai-assign-note"
                value={note}
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
                className="h-10"
              />
            </div>
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
