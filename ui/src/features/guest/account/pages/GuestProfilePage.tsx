import { GuestProfileForm } from '@/features/guest/account/components/GuestProfileForm';
import { GuestIdentityCard } from '@/features/verification/components/GuestIdentityCard';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestProfilePage() {
  usePageTitle(publicPageTitle('Profile'));
  return (
    <div className="space-y-4">
      <GuestProfileForm />
      <GuestIdentityCard />
    </div>
  );
}
