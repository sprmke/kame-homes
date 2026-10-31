import { AlertTriangle, UserMinus } from 'lucide-react';

import type { TeamMember } from '@/features/dashboard/team/types/propertyTeam';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  open: boolean;
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirmPending?: boolean;
  scopeLabel?: string;
  confirmLabel?: string;
};

export function RemoveMemberDialog({
  open,
  member,
  onOpenChange,
  onConfirm,
  confirmPending = false,
  scopeLabel = 'this property',
  confirmLabel = 'Remove Member',
}: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-[28rem]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" aria-hidden />
            Remove Team Member
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <p className="text-muted-foreground text-sm">
          Remove {member?.name} from {scopeLabel}? They will lose access immediately.
        </p>
        <ResponsiveModalFooter className="gap-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={confirmPending}>
            <UserMinus className="mr-2 size-4" aria-hidden />
            {confirmLabel}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
