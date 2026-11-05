import type { GuestReputation } from '@/features/reviews/lib/reviewApi';

type Props = {
  reputation: GuestReputation;
};

function formatAvg(value: number | null): string {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(1);
}

export function ReputationSummary({ reputation }: Props) {
  const wouldHost =
    reputation.wouldHostAgainRate == null
      ? 'n/a'
      : `${Math.round(reputation.wouldHostAgainRate * 100)}%`;
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-muted-foreground">Reviews</dt>
        <dd className="font-medium">{reputation.reviewCount}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Average</dt>
        <dd className="font-medium">{formatAvg(reputation.avgOverall)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Would host again</dt>
        <dd className="font-medium">{wouldHost}</dd>
      </div>
    </dl>
  );
}
