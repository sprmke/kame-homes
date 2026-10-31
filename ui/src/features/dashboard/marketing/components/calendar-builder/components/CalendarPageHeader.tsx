import { Link, useParams } from 'react-router-dom';

import { ArrowLeft } from 'lucide-react';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { Button } from '@/components/ui/button';

export function CalendarPageHeader() {
  const { orgSlug, propertySlug } = useParams<{ orgSlug: string; propertySlug: string }>();

  return (
    <AdminPageHeader
      title="Calendar Builder"
      subtitle="Design printable calendars for this property."
      actions={
        orgSlug && propertySlug ? (
          <Button variant="outline" size="sm" asChild className="min-h-[44px]">
            <Link to={propertySectionPath(orgSlug, propertySlug, 'marketing')} className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Marketing
            </Link>
          </Button>
        ) : null
      }
    />
  );
}
