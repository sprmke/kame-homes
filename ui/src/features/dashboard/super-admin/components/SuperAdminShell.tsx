import { AdminLayoutOutlet } from '@/features/dashboard/bookings/components/AdminLayout';
import { RequireSuperAdmin } from '@/features/dashboard/super-admin/components/RequireSuperAdmin';
import { SuperAdminCommandPalette } from '@/features/dashboard/super-admin/components/SuperAdminCommandPalette';
import { SuperAdminStepUpProvider } from '@/features/dashboard/super-admin/components/SuperAdminStepUpProvider';

export function SuperAdminShell() {
  return (
    <RequireSuperAdmin>
      <SuperAdminStepUpProvider>
        <SuperAdminCommandPalette />
        <AdminLayoutOutlet />
      </SuperAdminStepUpProvider>
    </RequireSuperAdmin>
  );
}
