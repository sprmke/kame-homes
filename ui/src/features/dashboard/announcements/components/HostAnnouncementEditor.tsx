import { useState, type ReactNode } from 'react';

import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { HostAnnouncementAdminList } from '@/features/dashboard/announcements/components/HostAnnouncementAdminList';
import { HostAnnouncementFormFields } from '@/features/dashboard/announcements/components/HostAnnouncementFormFields';
import {
  emptyHostAnnouncement,
  validateHostAnnouncements,
  type HostAnnouncementDraft,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import {
  superAdminApprovalDialogBodyClass,
  superAdminApprovalDialogContentClass,
  superAdminApprovalDialogFooterClass,
  superAdminApprovalDialogHeaderClass,
  superAdminApprovalFooterButtonClass,
} from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalDialogLayout';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

type Props = {
  announcements: HostAnnouncementDraft[];
  disabled?: boolean;
  onChange: (announcements: HostAnnouncementDraft[]) => void;
  /** Optional actions rendered beside “Add announcement” (e.g. link to developments). */
  trailingActions?: ReactNode;
};

/** Bigger than a typical settings dialog — same shell as the platform announcement modal —
 *  sized for a full CRUD form (title, WYSIWYG message, schedule, link). */
const ANNOUNCEMENT_EDITOR_DIALOG_CONTENT_CLASS = cn(
  superAdminApprovalDialogContentClass,
  'h-[min(92dvh,52rem)] max-h-[min(92dvh,52rem)] sm:w-[min(94vw,56rem)] sm:max-w-[56rem]'
);

/** Compact list + edit dialog. Changes apply to the in-memory draft array only — the
 *  surrounding development settings page still owns the actual save. */
export function HostAnnouncementEditor({
  announcements,
  disabled = false,
  onChange,
  trailingActions,
}: Props) {
  const [draft, setDraft] = useState<HostAnnouncementDraft | null>(null);
  const [baseline, setBaseline] = useState<HostAnnouncementDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const closeDialog = () => {
    setDraft(null);
    setBaseline(null);
    setIsNew(false);
  };

  const handleSave = (): boolean => {
    if (!draft) return false;
    const validationError = validateHostAnnouncements([draft]);
    if (validationError) {
      toast.error(validationError);
      return false;
    }
    const saved = { ...draft, updatedAt: new Date().toISOString() };
    onChange(
      isNew
        ? [...announcements, saved]
        : announcements.map((entry) => (entry.id === saved.id ? saved : entry))
    );
    closeDialog();
    return true;
  };

  const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
    open: draft !== null,
    onOpenChange: (open) => !open && closeDialog(),
    isDirty: draft !== null && JSON.stringify(draft) !== JSON.stringify(baseline),
    onSave: handleSave,
  });

  const handleRemove = () => {
    if (!draft) return;
    onChange(announcements.filter((entry) => entry.id !== draft.id));
    setDeleteConfirmOpen(false);
    closeDialog();
  };

  return (
    <div className="space-y-3">
      <HostAnnouncementAdminList
        announcements={announcements}
        emptyMessage="No announcements yet."
        onSelect={(announcement) => {
          setDraft(announcement);
          setBaseline(announcement);
          setIsNew(false);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] gap-1.5"
          disabled={disabled}
          onClick={() => {
            const fresh = emptyHostAnnouncement() as HostAnnouncementDraft;
            setDraft(fresh);
            setBaseline(fresh);
            setIsNew(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add announcement
        </Button>
        {trailingActions}
      </div>

      <ResponsiveModal open={draft !== null} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          className={ANNOUNCEMENT_EDITOR_DIALOG_CONTENT_CLASS}
          sheetLayout="split"
        >
          <ResponsiveModalHeader className={superAdminApprovalDialogHeaderClass}>
            <ResponsiveModalTitle className="pr-8 [overflow-wrap:anywhere]">
              {isNew ? 'New announcement' : draft?.title || 'Announcement'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className={superAdminApprovalDialogBodyClass}>
            {draft ? (
              <HostAnnouncementFormFields
                value={draft}
                disabled={disabled}
                onChange={(patch) =>
                  setDraft((current) => (current ? { ...current, ...patch } : current))
                }
              />
            ) : null}
          </div>
          <ResponsiveModalFooter className={superAdminApprovalDialogFooterClass}>
            {!isNew ? (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'text-destructive hover:text-destructive sm:mr-auto',
                  superAdminApprovalFooterButtonClass
                )}
                disabled={disabled}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Remove
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={superAdminApprovalFooterButtonClass}
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={superAdminApprovalFooterButtonClass}
              disabled={disabled}
              onClick={handleSave}
            >
              {isNew ? 'Add announcement' : 'Save changes'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              “{draft?.title || 'This announcement'}” will stop showing to hosts. This can’t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={(event) => {
                event.preventDefault();
                handleRemove();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
