import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import {
  TicketComposeForm,
  type TicketComposeStatus,
} from '@/features/dashboard/help-support/components/TicketComposeForm';
import type { SupportTicketCategory } from '@/features/dashboard/help-support/lib/supportTicketSchema';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useRunUnguarded } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';

const FORM_ID = 'new-support-ticket-form';

const IDLE_STATUS: TicketComposeStatus = {
  canSubmit: false,
  submitting: false,
  uploading: false,
  dirty: false,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (ticketId: string) => void;
  defaultSubject?: string;
  defaultCategory?: SupportTicketCategory;
};

export function NewTicketModal({
  open,
  onOpenChange,
  onSubmitted,
  defaultSubject,
  defaultCategory,
}: Props) {
  const [status, setStatus] = useState<TicketComposeStatus>(IDLE_STATUS);
  const runUnguarded = useRunUnguarded();

  useEffect(() => {
    if (open) return;
    setStatus(IDLE_STATUS);
  }, [open]);

  const blocked = status.submitting || status.uploading;

  // Closing navigates (compose lives in the URL); skip the route guard for that hop.
  const {
    onOpenChange: guardedOpenChange,
    requestClose: guardedRequestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange: (next) => runUnguarded(() => onOpenChange(next)),
    isDirty: status.dirty,
  });
  const discardOpen = dialogProps.open;

  const requestClose = () => {
    if (blocked) return;
    guardedRequestClose();
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (blocked) return;
    guardedOpenChange(false);
  };

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          showCloseButton
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (blocked || discardOpen) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            requestClose();
          }}
          onPointerDownOutside={(event) => {
            if (blocked || discardOpen) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            requestClose();
          }}
          onInteractOutside={(event) => {
            if (blocked || discardOpen) event.preventDefault();
          }}
          className={cn(
            'flex h-[min(90dvh,44rem)] max-h-[min(90dvh,44rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
            'sm:h-[min(90dvh,44rem)] sm:max-h-[min(90dvh,44rem)] sm:w-[min(92vw,40rem)] sm:max-w-[40rem] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border shrink-0 space-y-1 border-b px-5 pb-3.5 pr-14 pt-5 text-left sm:px-6">
            <ResponsiveModalTitle>New ticket</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            {open ? (
              <TicketComposeForm
                formId={FORM_ID}
                hideSubmit
                onStatusChange={setStatus}
                onSubmitted={(id) => runUnguarded(() => onSubmitted(id))}
                defaultSubject={defaultSubject}
                defaultCategory={defaultCategory}
              />
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border shrink-0 border-t px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="submit"
              form={FORM_ID}
              disabled={!status.canSubmit || blocked}
              className="min-h-11 w-full sm:w-auto"
            >
              {status.submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Submit
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
