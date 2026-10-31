import {
  DEFAULT_PARKING_AUTOMATION_TOGGLES,
  PARKING_AUTOMATION_TOGGLE_LABELS,
  PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS,
  type ParkingAutomationToggles,
} from '@/features/dashboard/parking/lib/parkingEmailAutomation';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Props = {
  value: ParkingAutomationToggles;
  disabled?: boolean;
  onChange: (key: keyof ParkingAutomationToggles, enabled: boolean) => void;
};

export function ParkingEmailAutomationSection({ value, disabled, onChange }: Props) {
  const toggles = value ?? DEFAULT_PARKING_AUTOMATION_TOGGLES;

  return (
    <div className="space-y-3">
      {PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS.map((key) => (
        <div key={key} className="flex min-h-[44px] items-center justify-between gap-4">
          <Label htmlFor={`parking-automation-${key}`} className="text-sm font-medium">
            {PARKING_AUTOMATION_TOGGLE_LABELS[key]}
          </Label>
          <Switch
            id={`parking-automation-${key}`}
            checked={toggles[key]}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(key, checked)}
          />
        </div>
      ))}
    </div>
  );
}
