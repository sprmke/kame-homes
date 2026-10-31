import { AdminLayoutOutlet } from '@/features/dashboard/bookings/components/AdminLayout';
import { RequireAdmin } from '@/features/dashboard/bookings/components/RequireAdmin';
import { PropertyPlanLimitedGate } from '@/features/dashboard/org/components/PropertyPlanLimitedGate';
import { PropertySettingsIssuesSync } from '@/features/dashboard/org/components/PropertySettingsIssuesSync';
import { RequireOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { RequireOrgNotHardRejected } from '@/features/dashboard/org/components/RequireOrgNotHardRejected';

/** Property-scoped admin shell: auth + org/property context + persistent AdminLayout. */
export function PropertyAdminShell() {
  return (
    <RequireAdmin>
      <RequireOrgNotHardRejected>
        <RequireOrgContext>
          <PropertySettingsIssuesSync />
          <PropertyPlanLimitedGate>
            <AdminLayoutOutlet />
          </PropertyPlanLimitedGate>
        </RequireOrgContext>
      </RequireOrgNotHardRejected>
    </RequireAdmin>
  );
}
