import { useState } from 'react';

import { Zap } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { SettingsManageButton } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { ParkingBookingAutomationSection } from '@/features/dashboard/parking/components/ParkingBookingAutomationSection';
import { ParkingEmailAutomationSection } from '@/features/dashboard/parking/components/ParkingEmailAutomationSection';
import {
  PARKING_AUTOMATION_TOGGLE_KEYS,
  type ParkingAutomationToggles,
} from '@/features/dashboard/parking/lib/parkingEmailAutomation';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  value: ParkingAutomationToggles;
  disabled?: boolean;
  onChange: (key: keyof ParkingAutomationToggles, enabled: boolean) => void;
  /** Inline toggles (Setup Guide) instead of summary row + Manage modal. */
  embedded?: boolean;
};

export function ParkingAutomationsSection({ value, disabled, onChange, embedded = false }: Props) {
  const [manageOpen, setManageOpen] = useState(false);

  const enabledCount = PARKING_AUTOMATION_TOGGLE_KEYS.filter((key) => value[key]).length;
  const totalCount = PARKING_AUTOMATION_TOGGLE_KEYS.length;

  const toggles = (
    <div className="space-y-4">
      <ParkingEmailAutomationSection value={value} disabled={disabled} onChange={onChange} />
      <ParkingBookingAutomationSection value={value} disabled={disabled} onChange={onChange} />
    </div>
  );

  return (
    <AdminSection
      id="automations"
      title="Automations"
      icon={Zap}
      description="Emails sent automatically and host actions taken for you."
    >
      {embedded ? (
        toggles
      ) : (
        <>
          <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-card-description min-w-0 flex-1">
              {enabledCount} of {totalCount} on
            </p>
            <SettingsManageButton disabled={disabled} onClick={() => setManageOpen(true)} />
          </div>

          <ResponsiveModal open={manageOpen} onOpenChange={setManageOpen}>
            <ResponsiveModalContent
              sheetLayout="split"
              className="flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,40rem)] sm:p-0"
            >
              <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
                <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
                  Automations
                </ResponsiveModalTitle>
              </ResponsiveModalHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
                {toggles}
              </div>

              <ResponsiveModalFooter className="border-border/60 flex shrink-0 border-t px-4 py-3 sm:px-5">
                <Button
                  type="button"
                  className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
                  onClick={() => setManageOpen(false)}
                >
                  Done
                </Button>
              </ResponsiveModalFooter>
            </ResponsiveModalContent>
          </ResponsiveModal>
        </>
      )}
    </AdminSection>
  );
}
