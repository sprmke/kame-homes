import { Megaphone } from 'lucide-react';

import { HostAnnouncementEditor } from '@/features/dashboard/announcements/components/HostAnnouncementEditor';
import type { HostAnnouncementDraft } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';

type Props = {
  announcements: HostAnnouncementDraft[];
  disabled?: boolean;
  onChange: (announcements: HostAnnouncementDraft[]) => void;
};

export function DevelopmentAnnouncementsSection({
  announcements,
  disabled = false,
  onChange,
}: Props) {
  return (
    <AdminSection id="announcements" title="Announcements" icon={Megaphone}>
      <HostAnnouncementEditor
        announcements={announcements}
        disabled={disabled}
        onChange={onChange}
      />
    </AdminSection>
  );
}
