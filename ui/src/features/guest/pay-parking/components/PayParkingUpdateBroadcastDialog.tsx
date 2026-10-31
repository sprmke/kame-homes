import { Loader2, Mail, Save, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type PayParkingEmailChoiceVariant = 'submit' | 'update';

type Props = {
  open: boolean;
  pending: boolean;
  variant: PayParkingEmailChoiceVariant;
  onOpenChange: (open: boolean) => void;
  onSaveWithBroadcast: () => void;
  onSaveWithOwnerEmail: () => void;
  onSaveOnly: () => void;
};

const COPY: Record<
  PayParkingEmailChoiceVariant,
  {
    title: string;
    description: string;
    broadcast: string;
    owner: string;
    only: string;
  }
> = {
  submit: {
    title: 'Submit parking request',
    description: 'Notify parking owners by email, or save vehicle details without sending email.',
    broadcast: 'Save and send broadcast email',
    owner: 'Save and send to parking owner email',
    only: 'Save details only',
  },
  update: {
    title: 'Update parking details',
    description: 'Notify parking owners again, or save changes without sending email.',
    broadcast: 'Update and send broadcast email',
    owner: 'Update and send to parking owner email',
    only: 'Update details only',
  },
};

export function PayParkingUpdateBroadcastDialog({
  open,
  pending,
  variant,
  onOpenChange,
  onSaveWithBroadcast,
  onSaveWithOwnerEmail,
  onSaveOnly,
}: Props) {
  const copy = COPY[variant];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{copy.title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{copy.description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full gap-2"
            disabled={pending}
            onClick={onSaveWithBroadcast}
          >
            {pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-4 shrink-0" aria-hidden />
            )}
            {copy.broadcast}
          </Button>
          <Button
            type="button"
            className="min-h-[44px] w-full gap-2"
            disabled={pending}
            onClick={onSaveWithOwnerEmail}
          >
            {pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <UserRound className="size-4 shrink-0" aria-hidden />
            )}
            {copy.owner}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full gap-2"
            disabled={pending}
            onClick={onSaveOnly}
          >
            {pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4 shrink-0" aria-hidden />
            )}
            {copy.only}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
