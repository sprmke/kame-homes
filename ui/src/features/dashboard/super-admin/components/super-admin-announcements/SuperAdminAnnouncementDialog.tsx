import { useEffect, useState } from 'react';

import { toast } from 'sonner';

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
import {
  usePlatformHostSettings,
  useUpdatePlatformHostSettings,
} from '@/features/dashboard/super-admin/hooks/usePlatformHostSettings';

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
import { Skeleton } from '@/components/ui/skeleton';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

export type SuperAdminAnnouncementDialogState = { mode: 'create' } | { mode: 'edit'; id: string };

/** Bigger than the ticket/approval dialogs — this holds a full CRUD form (title, WYSIWYG
 *  message, schedule, link), not a message thread. */
const ANNOUNCEMENT_DIALOG_CONTENT_CLASS = cn(
  superAdminApprovalDialogContentClass,
  'h-[min(92dvh,52rem)] max-h-[min(92dvh,52rem)] sm:w-[min(94vw,56rem)] sm:max-w-[56rem]'
);

type Props = {
  state: SuperAdminAnnouncementDialogState | null;
  onOpenChange: (open: boolean) => void;
};

/** Big "manage this announcement" modal — same standard admin dialog shell as the ticket
 *  detail / approval dialogs, sized for a full CRUD form instead of a thread. */
export function SuperAdminAnnouncementDialog({ state, onOpenChange }: Props) {
  const { data, isLoading } = usePlatformHostSettings();
  const updateSettings = useUpdatePlatformHostSettings();
  const [draft, setDraft] = useState<HostAnnouncementDraft | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isCreate = state?.mode === 'create';
  const stateKey = state ? (state.mode === 'edit' ? state.id : 'create') : null;

  useEffect(() => {
    if (!state || !data) return;
    if (state.mode === 'create') {
      const empty = emptyHostAnnouncement() as HostAnnouncementDraft;
      setDraft(empty);
      setBaseline(JSON.stringify(empty));
      return;
    }
    const existing = data.announcements.find((entry) => entry.id === state.id);
    setDraft(existing ?? null);
    setBaseline(existing ? JSON.stringify(existing) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, data?.updatedAt]);

  const handleSave = async (): Promise<boolean> => {
    if (!draft || !data) return false;
    const validationError = validateHostAnnouncements([draft]);
    if (validationError) {
      toast.error(validationError);
      return false;
    }
    const saved = { ...draft, updatedAt: new Date().toISOString() };
    const nextAnnouncements = isCreate
      ? [...data.announcements, saved]
      : data.announcements.map((entry) => (entry.id === saved.id ? saved : entry));
    try {
      await updateSettings.mutateAsync({ announcements: nextAnnouncements });
      toast.success(isCreate ? 'Announcement added' : 'Announcement saved');
      onOpenChange(false);
      return true;
    } catch (err) {
      toast.error(friendlyToastError(err, 'Could not save announcement'));
      return false;
    }
  };

  const isDirty = state !== null && draft !== null && JSON.stringify(draft) !== baseline;
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open: state !== null,
    onOpenChange,
    isDirty,
    onSave: handleSave,
  });

  const handleDelete = async () => {
    if (!draft || !data) return;
    try {
      await updateSettings.mutateAsync({
        announcements: data.announcements.filter((entry) => entry.id !== draft.id),
      });
      toast.success('Announcement removed');
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(friendlyToastError(err, 'Could not remove announcement'));
    }
  };

  const busy = updateSettings.isPending;
  const loading = isLoading || (state !== null && !draft);

  return (
    <>
      <ResponsiveModal open={state !== null} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent className={ANNOUNCEMENT_DIALOG_CONTENT_CLASS} sheetLayout="split">
          <ResponsiveModalHeader className={superAdminApprovalDialogHeaderClass}>
            <ResponsiveModalTitle className="pr-8 [overflow-wrap:anywhere]">
              {isCreate ? 'New announcement' : draft?.title || 'Announcement'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className={superAdminApprovalDialogBodyClass}>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            ) : draft ? (
              <HostAnnouncementFormFields
                value={draft}
                disabled={busy}
                onChange={(patch) =>
                  setDraft((current) => (current ? { ...current, ...patch } : current))
                }
              />
            ) : (
              <p className="text-destructive text-sm">This announcement no longer exists.</p>
            )}
          </div>

          <ResponsiveModalFooter className={superAdminApprovalDialogFooterClass}>
            {!isCreate && draft ? (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'text-destructive hover:text-destructive sm:mr-auto',
                  superAdminApprovalFooterButtonClass
                )}
                disabled={busy}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={superAdminApprovalFooterButtonClass}
              disabled={busy}
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={superAdminApprovalFooterButtonClass}
              disabled={busy || !draft}
              onClick={() => void handleSave()}
            >
              {busy ? 'Saving…' : isCreate ? 'Add announcement' : 'Save changes'}
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
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
