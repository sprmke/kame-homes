import { ArrowUpFromLine, Bike, Car, Home, MoveHorizontal, Ruler } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { resolveVehicleFit } from '@/features/dashboard/parking/lib/parkingDimensionDefaults';
import type {
  ParkingDetailsDraft,
  ParkingVehicleTypeDraft,
} from '@/features/dashboard/parking/lib/parkingSettingsForm';

import { CheckboxDisplay } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  draft: ParkingDetailsDraft;
  onChange: (next: ParkingDetailsDraft) => void;
  disabled?: boolean;
  resolveFieldError?: (fieldId: string) => string | null;
  markFieldInteracted?: (fieldId: string) => void;
  /** Compact card chrome for Setup Guide and other embedded hosts. */
  dense?: boolean;
};

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

const VEHICLE_TYPE_OPTIONS: { value: ParkingVehicleTypeDraft; label: string; icon: typeof Car }[] =
  [
    { value: 'car', label: 'Car', icon: Car },
    { value: 'motorcycle', label: 'Motorcycle', icon: Bike },
  ];

const CAR_TIER_LABELS: Record<string, string> = {
  compact: 'Compact',
  sedan: 'Sedan',
  suv: 'SUV',
  van: 'Van',
};

function fitPreviewLabel(draft: ParkingDetailsDraft): string {
  const fit = resolveVehicleFit({
    spaceLengthM: Number(draft.spaceLengthM) || 0,
    spaceWidthM: Number(draft.spaceWidthM) || 0,
    heightClearanceM: Number(draft.heightClearanceM) || 0,
    acceptedVehicleTypes: draft.acceptedVehicleTypes,
  });
  const parts: string[] = [];
  if (fit.carTiers.length > 0) {
    parts.push(fit.carTiers.map((tier) => CAR_TIER_LABELS[tier]).join(', '));
  }
  if (fit.acceptsMotorcycle) {
    parts.push('Motorcycle');
  }
  return parts.length > 0 ? parts.join(' · ') : 'No fitting vehicle sizes';
}

export function ParkingDetailsSection({
  draft,
  onChange,
  disabled = false,
  resolveFieldError = () => null,
  markFieldInteracted = () => {},
  dense = false,
}: Props) {
  const setField = <K extends keyof ParkingDetailsDraft>(key: K, value: ParkingDetailsDraft[K]) => {
    onChange({ ...draft, [key]: value });
  };

  const toggleVehicleType = (value: ParkingVehicleTypeDraft) => {
    const enabled = draft.acceptedVehicleTypes.includes(value);
    const next = enabled
      ? draft.acceptedVehicleTypes.filter((v) => v !== value)
      : [...draft.acceptedVehicleTypes, value];
    if (next.length === 0) return;
    setField('acceptedVehicleTypes', next);
  };

  return (
    <AdminSection
      id="details"
      title="Parking Details"
      icon={Home}
      description="Vehicle types, dimensions, and check-in times."
      dense={dense}
    >
      <SettingsField id="parking-accepted-vehicle-types" label="Accepted vehicle types">
        <div className="grid gap-2 sm:grid-cols-2">
          {VEHICLE_TYPE_OPTIONS.map((option) => {
            const enabled = draft.acceptedVehicleTypes.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => toggleVehicleType(option.value)}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  enabled
                    ? 'border-border bg-background shadow-sm'
                    : 'border-border/60 hover:bg-muted/40'
                )}
              >
                <CheckboxDisplay checked={enabled} />
                <option.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{option.label}</span>
              </button>
            );
          })}
        </div>
      </SettingsField>

      <p className="text-muted-foreground text-sm">Fits: {fitPreviewLabel(draft)}</p>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <SettingsField id="parking-space-length" label="Length (m)">
          <div className="relative">
            <Ruler
              className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="parking-space-length"
              type="number"
              min={0}
              step={0.1}
              value={draft.spaceLengthM}
              onChange={(event) => setField('spaceLengthM', event.target.value)}
              disabled={disabled}
              placeholder="Optional"
              className="h-10 pl-9"
            />
          </div>
        </SettingsField>

        <SettingsField id="parking-space-width" label="Width (m)">
          <div className="relative">
            <MoveHorizontal
              className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="parking-space-width"
              type="number"
              min={0}
              step={0.1}
              value={draft.spaceWidthM}
              onChange={(event) => setField('spaceWidthM', event.target.value)}
              disabled={disabled}
              placeholder="Optional"
              className="h-10 pl-9"
            />
          </div>
        </SettingsField>

        <SettingsField id="parking-height-clearance" label="Height clearance (m)">
          <div className="relative">
            <ArrowUpFromLine
              className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="parking-height-clearance"
              type="number"
              min={0}
              step={0.1}
              value={draft.heightClearanceM}
              onChange={(event) => setField('heightClearanceM', event.target.value)}
              disabled={disabled}
              placeholder="Optional"
              className="h-10 pl-9"
            />
          </div>
        </SettingsField>
      </div>

      <FieldGrid>
        <SettingsField
          id="parking-check-in"
          label="Check-in Time"
          required
          error={resolveFieldError('parking-check-in')}
        >
          <Input
            id="parking-check-in"
            type="time"
            value={draft.checkInTime}
            onChange={(event) => setField('checkInTime', event.target.value)}
            onBlur={() => markFieldInteracted('parking-check-in')}
            disabled={disabled}
            aria-invalid={Boolean(resolveFieldError('parking-check-in'))}
            className={cn('h-10', resolveFieldError('parking-check-in') && 'border-destructive')}
          />
        </SettingsField>

        <SettingsField
          id="parking-check-out"
          label="Check-out Time"
          required
          error={resolveFieldError('parking-check-out')}
        >
          <Input
            id="parking-check-out"
            type="time"
            value={draft.checkOutTime}
            onChange={(event) => setField('checkOutTime', event.target.value)}
            onBlur={() => markFieldInteracted('parking-check-out')}
            disabled={disabled}
            aria-invalid={Boolean(resolveFieldError('parking-check-out'))}
            className={cn('h-10', resolveFieldError('parking-check-out') && 'border-destructive')}
          />
        </SettingsField>
      </FieldGrid>
    </AdminSection>
  );
}
