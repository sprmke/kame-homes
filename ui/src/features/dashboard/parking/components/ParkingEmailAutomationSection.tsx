import {
  DEFAULT_PARKING_AUTOMATION_TOGGLES,
  PARKING_AUTOMATION_TOGGLE_LABELS,
  PARKING_EMAIL_AUTOMATION_COPY,
  PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS,
  type ParkingAutomationToggles,
} from '@/features/dashboard/parking/lib/parkingEmailAutomation';

import { Switch } from '@/components/ui/switch';

type Props = {
  value: ParkingAutomationToggles;
  disabled?: boolean;
  onChange: (key: keyof ParkingAutomationToggles, enabled: boolean) => void;
};

export function ParkingEmailAutomationSection({ value, disabled, onChange }: Props) {
  const toggles = value ?? DEFAULT_PARKING_AUTOMATION_TOGGLES;

  return (
    <div className="space-y-2">
      {PARKING_EMAIL_AUTOMATION_TOGGLE_KEYS.map((key) => {
        const copy = PARKING_EMAIL_AUTOMATION_COPY[key];
        return (
          <div
            key={key}
            className="border-border/40 bg-muted/15 flex min-h-[44px] items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <label htmlFor={`parking-automation-${key}`} className="text-sm font-medium leading-snug">
                {PARKING_AUTOMATION_TOGGLE_LABELS[key]}
              </label>
              <p className="text-xs leading-snug">
                <span className="text-foreground/90 font-medium">To:</span>{' '}
                <span className="text-muted-foreground">{copy.recipient}</span>
              </p>
              <p className="text-xs leading-snug">
                <span className="text-foreground/90 font-medium">When:</span>{' '}
                <span className="text-muted-foreground">{copy.trigger}</span>
              </p>
            </div>
            <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
              <Switch
                id={`parking-automation-${key}`}
                checked={toggles[key]}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(key, checked)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
