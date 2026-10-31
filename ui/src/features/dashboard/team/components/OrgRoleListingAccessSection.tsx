import {
  OrgListingAssignmentPicker,
  type OrgListingAssignments,
} from '@/features/dashboard/team/components/OrgListingAssignmentPicker';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

type ListingMode = 'all' | 'selected';

const LISTING_SCOPE_OPTIONS: ReadonlyArray<{
  value: ListingMode;
  label: string;
  description: string;
}> = [
  {
    value: 'all',
    label: 'All listings',
    description: 'Every property and parking in this org',
  },
  {
    value: 'selected',
    label: 'Choose listings',
    description: 'Pick specific properties and parkings',
  },
];

type Props = {
  orgSlug: string;
  allListings: boolean;
  assignments: OrgListingAssignments;
  onAllListingsChange: (value: boolean) => void;
  onAssignmentsChange: (value: OrgListingAssignments) => void;
  disabled?: boolean;
  className?: string;
};

export function OrgRoleListingAccessSection({
  orgSlug,
  allListings,
  assignments,
  onAllListingsChange,
  onAssignmentsChange,
  disabled = false,
  className,
}: Props) {
  const mode: ListingMode = allListings ? 'all' : 'selected';

  const setMode = (next: ListingMode) => {
    if (next === 'all') {
      onAllListingsChange(true);
      return;
    }
    onAllListingsChange(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">Listing access</Label>
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as ListingMode)}
          disabled={disabled}
          className="space-y-2.5"
        >
          {LISTING_SCOPE_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  'flex min-h-[44px] cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:bg-muted/30',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <RadioGroupItem value={option.value} disabled={disabled} className="mt-0.5" />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground block text-xs">{option.description}</span>
                </span>
              </label>
            );
          })}
        </RadioGroup>

        {!allListings ? (
          <div className="border-border/60 mt-4 border-t pt-4">
            <OrgListingAssignmentPicker
              orgSlug={orgSlug}
              allListings={false}
              assignments={assignments}
              onAllListingsChange={onAllListingsChange}
              onAssignmentsChange={onAssignmentsChange}
              disabled={disabled}
              showAllListingsToggle={false}
              embedded
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
