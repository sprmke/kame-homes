import { useState } from 'react';

import { AlertTriangle, Trash2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

export function OrgDangerZoneSection({
  orgName,
  orgSlug,
  disabled = false,
  deletePending = false,
  onDelete,
}: {
  orgName: string;
  orgSlug: string;
  disabled?: boolean;
  deletePending?: boolean;
  onDelete: () => Promise<void>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');

  const handleDelete = async () => {
    try {
      await onDelete();
      setDeleteOpen(false);
      setConfirmSlug('');
    } catch {
      // Parent shows toast
    }
  };

  const slugMatches = confirmSlug.trim() === orgSlug;

  return (
    <AdminSection
      id="danger"
      title="Danger zone"
      icon={AlertTriangle}
      description="Irreversible actions that affect your entire organization."
      className="border-destructive/50"
    >
      <div className="border-destructive/50 flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-destructive text-xs font-semibold sm:text-sm">Delete organization</p>
          <p className="text-card-description">
            Permanently delete this organization and all its data. This cannot be undone.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled || deletePending}
          className="settings-action w-full gap-1.5 sm:w-auto"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          {deletePending ? 'Deleting…' : 'Delete organization'}
        </Button>
      </div>

      <ResponsiveModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmSlug('');
        }}
      >
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="text-destructive">
              Delete organization
            </ResponsiveModalTitle>
            <ResponsiveModalDescription asChild>
              <div className="text-muted-foreground space-y-2 text-sm">
                <p>Are you sure you want to delete &quot;{orgName}&quot;?</p>
                <p>
                  This will permanently delete the organization and all its data. This action cannot
                  be undone.
                </p>
              </div>
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-org-delete">
              Type <span className="text-foreground font-semibold">{orgSlug}</span> to confirm
            </Label>
            <Input
              id="confirm-org-delete"
              value={confirmSlug}
              onChange={(event) => setConfirmSlug(event.target.value)}
              disabled={deletePending}
              placeholder={orgSlug}
              className="h-10"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ResponsiveModalFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] w-full gap-1.5 sm:w-auto"
              disabled={deletePending || !slugMatches}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-4" aria-hidden />
              {deletePending ? 'Deleting…' : 'Yes, delete organization'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </AdminSection>
  );
}
