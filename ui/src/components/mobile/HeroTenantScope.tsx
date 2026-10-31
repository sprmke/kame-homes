import { lazy, Suspense } from 'react';

// Lazy so route skeletons that render the mobile hero do not pull the tenant switchers
// (and their add-property dialog) into the public entry chunk.
const SidebarTenantScope = lazy(() =>
  import('@/features/dashboard/org/components/TenantSwitchers').then((m) => ({
    default: m.SidebarTenantScope,
  }))
);
const SuperAdminSidebarScope = lazy(() =>
  import('@/features/dashboard/super-admin/components/SuperAdminSidebarScope').then((m) => ({
    default: m.SuperAdminSidebarScope,
  }))
);

/** Org/property/parking (or super-admin) scope pill on the teal mobile hero. */
export function HeroTenantScope({ superAdmin = false }: { superAdmin?: boolean }) {
  return (
    <Suspense fallback={<div className="h-11" aria-hidden />}>
      {superAdmin ? (
        <SuperAdminSidebarScope collapsed={false} variant="onPrimary" />
      ) : (
        <SidebarTenantScope collapsed={false} variant="onPrimary" />
      )}
    </Suspense>
  );
}
