import type { ParkingAutomationToggles } from '@/features/dashboard/parking/lib/parkingEmailAutomation';
import { DEFAULT_PARKING_AUTOMATION_TOGGLES } from '@/features/dashboard/parking/lib/parkingEmailAutomation';

import { FieldLabel } from '@/components/forms/FieldLabel';
import { Switch } from '@/components/ui/switch';

type Props = {
  value: ParkingAutomationToggles;
  disabled?: boolean;
  onChange: (key: keyof ParkingAutomationToggles, enabled: boolean) => void;
};

/** Phase 5 — the top-ranked candidate is claimed automatically instead of waiting for a manual Accept tap. */
export function ParkingBookingAutomationSection({ value, disabled, onChange }: Props) {
  const toggles = value ?? DEFAULT_PARKING_AUTOMATION_TOGGLES;

  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4">
      <FieldLabel
        htmlFor="parking-automation-autoAcceptTopMatch"
        label="Auto-accept top match"
        help="Automatically accept the top-ranked request instead of waiting for a manual Accept. The guest still has to pay before endorsement fires."
        className="min-w-0 flex-1"
      />
      <Switch
        id="parking-automation-autoAcceptTopMatch"
        checked={toggles.autoAcceptTopMatch}
        disabled={disabled}
        onCheckedChange={(checked) => onChange('autoAcceptTopMatch', checked)}
      />
    </div>
  );
}
