import { useRef, useState } from 'react';

import { AlertCircle } from 'lucide-react';

import { ListingContractConsiderationForm } from '@/features/dashboard/org/components/listing-authorization/ListingContractConsiderationForm';
import { ListingContractRenewalModalBody } from '@/features/dashboard/org/components/listing-authorization/ListingContractRenewalModalBody';
import {
  daysUntilContractAccessLock,
  daysUntilContractEnd,
  hasActiveConsiderationGrant,
  type ContractLegLifecycle,
  type ListingContractRenewalPhase,
} from '@/features/dashboard/org/lib/contractLifecycle';
import type { ListingKind } from '@/features/dashboard/org/lib/listingAuthorization';
import {
  LISTING_CONTRACT_RENEWAL_DISMISS,
  LISTING_CONTRACT_RENEWAL_PRIMARY,
  listingContractRenewalTitle,
} from '@/features/dashboard/org/lib/listingContractRenewalCopy';
import {
  dismissListingContractRenewalForToday,
  persistsListingContractRenewalDailyDismiss,
} from '@/features/dashboard/org/lib/listingContractRenewalDismiss';
import { todayManilaYmd } from '@/features/dashboard/org/lib/orgVerification';

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
import { cn } from '@/lib/utils';
import { formatYmdToFullLongDate } from '@/utils/format/dates';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissible: boolean;
  phase: ListingContractRenewalPhase;
  listingKind: ListingKind;
  listingId: string;
  orgId: string;
  listingName: string;
  contractEndYmd: string | null;
  lifecycle: ContractLegLifecycle;
  onSubmitRenewal: () => void;
};

function renewalTitleIconClass(phase: ListingContractRenewalPhase): string {
  switch (phase) {
    case 'locked':
      return 'bg-destructive/10 text-destructive';
    case 'grace':
    case 'pre_expiry':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    default:
      return 'bg-primary/10 text-primary';
  }
}

export function ListingContractRenewalModal({
  open,
  onOpenChange,
  dismissible,
  phase,
  listingKind,
  listingId,
  orgId,
  listingName,
  contractEndYmd,
  lifecycle,
  onSubmitRenewal,
}: Props) {
  const today = todayManilaYmd();
  const [showConsideration, setShowConsideration] = useState(false);
  const [considerationDirty, setConsiderationDirty] = useState(false);
  const considerationSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const granted = hasActiveConsiderationGrant(lifecycle, today);
  const daysLeft =
    contractEndYmd && phase === 'pre_expiry' ? daysUntilContractEnd(contractEndYmd, today) : null;
  const daysUntilLock =
    contractEndYmd && phase === 'grace' ? daysUntilContractAccessLock(contractEndYmd, today) : null;

  const title = listingContractRenewalTitle(phase);

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange: (next) => {
      onOpenChange(next);
      if (!next) setShowConsideration(false);
    },
    isDirty: considerationDirty,
    onSave: async () => (await considerationSaveRef.current?.()) ?? false,
  });

  const handleOpenChange = (next: boolean) => {
    if (!dismissible && !next) return;
    guardedOpenChange(next);
  };

  const handleDismiss = () => {
    if (considerationDirty) {
      requestClose();
      return;
    }
    if (persistsListingContractRenewalDailyDismiss(phase)) {
      dismissListingContractRenewalForToday(listingKind, listingId, today);
    }
    handleOpenChange(false);
  };

  const showConsiderationPanel =
    showConsideration &&
    (phase === 'grace' ||
      (phase === 'locked' && lifecycle.consideration.allowConsiderationOverride));

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(90dvh,32rem)] w-[min(calc(100vw-1.5rem),28rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
            'sm:max-w-[28rem] sm:p-0'
          )}
          onPointerDownOutside={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border shrink-0 border-b px-5 pb-3.5 pt-5 text-left sm:px-6">
            <ResponsiveModalTitle className="flex items-center gap-2.5 text-left text-base font-semibold sm:text-lg">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  renewalTitleIconClass(phase)
                )}
              >
                <AlertCircle className="size-5" aria-hidden />
              </span>
              {title}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <p className="text-muted-foreground text-sm leading-relaxed">
              <ListingContractRenewalModalBody
                phase={phase}
                listingName={listingName}
                contractEndYmd={contractEndYmd}
                daysUntilEnd={daysLeft}
                daysUntilLock={daysUntilLock}
              />
            </p>

            {granted && lifecycle.consideration.grantedUntil ? (
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                Temporary access until{' '}
                {formatYmdToFullLongDate(lifecycle.consideration.grantedUntil) ||
                  lifecycle.consideration.grantedUntil}
                .
              </p>
            ) : null}

            {showConsiderationPanel ? (
              <div className="mt-4">
                <ListingContractConsiderationForm
                  listingKind={listingKind}
                  listingId={listingId}
                  orgId={orgId}
                  contractEndYmd={contractEndYmd}
                  lifecycle={lifecycle}
                  allowLockedOverride={phase === 'locked'}
                  onDirtyChange={setConsiderationDirty}
                  saveRef={considerationSaveRef}
                />
              </div>
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border shrink-0 flex-col gap-2 border-t px-5 py-3 sm:flex-col sm:px-6">
            <Button type="button" className="min-h-[44px] w-full" onClick={onSubmitRenewal}>
              {LISTING_CONTRACT_RENEWAL_PRIMARY}
            </Button>
            {phase === 'grace' && !showConsiderationPanel ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => setShowConsideration(true)}
              >
                Request consideration
              </Button>
            ) : null}
            {phase === 'locked' &&
            lifecycle.consideration.allowConsiderationOverride &&
            !showConsiderationPanel ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => setShowConsideration(true)}
              >
                Request consideration
              </Button>
            ) : null}
            {dismissible ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] w-full"
                onClick={handleDismiss}
              >
                {LISTING_CONTRACT_RENEWAL_DISMISS}
              </Button>
            ) : null}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
