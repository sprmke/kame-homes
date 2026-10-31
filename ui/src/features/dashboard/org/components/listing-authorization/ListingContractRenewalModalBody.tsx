import type { ListingContractRenewalPhase } from '@/features/dashboard/org/lib/contractLifecycle';

import { formatYmdToFullLongDate } from '@/utils/format/dates';

type Props = {
  phase: ListingContractRenewalPhase;
  listingName: string;
  contractEndYmd: string | null;
  daysUntilEnd: number | null;
  daysUntilLock: number | null;
};

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground font-semibold">{children}</span>;
}

function formatContractEndLabel(ymd: string | null): string {
  if (!ymd) return 'the end date';
  return formatYmdToFullLongDate(ymd) || ymd;
}

function daysLabel(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

export function ListingContractRenewalModalBody({
  phase,
  listingName,
  contractEndYmd,
  daysUntilEnd,
  daysUntilLock,
}: Props) {
  const name = listingName.trim() || 'this listing';
  const endLabel = formatContractEndLabel(contractEndYmd);

  switch (phase) {
    case 'pre_expiry':
      return (
        <>
          Your hosting contract for {name} ends on <Highlight>{endLabel}</Highlight>
          {daysUntilEnd != null ? (
            <>
              {' '}
              (<Highlight>{daysLabel(daysUntilEnd)}</Highlight> left)
            </>
          ) : null}
          . To keep this listing verified and avoid restrictions after the end date, submit a
          renewal contract before then. You can upload it in Listing Verification.
        </>
      );
    case 'grace':
      return (
        <>
          Your hosting contract for {name} ended on <Highlight>{endLabel}</Highlight>. You have{' '}
          {daysUntilLock != null ? (
            <Highlight>{daysLabel(daysUntilLock)}</Highlight>
          ) : (
            'limited time'
          )}{' '}
          to renew or request consideration before access is locked and this listing cannot be
          accessed.
        </>
      );
    case 'locked':
      return (
        <>
          The grace period for {name} has ended. Submit a full renewal for review to restore access.
        </>
      );
    case 'granted':
      return (
        <>
          Temporary consideration access is active for {name}. Submit a renewal contract before it
          ends to keep this listing verified.
        </>
      );
    default:
      return null;
  }
}
