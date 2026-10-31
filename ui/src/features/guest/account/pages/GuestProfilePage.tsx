import { GuestProfileForm } from '@/features/guest/account/components/GuestProfileForm';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function GuestProfilePage() {
  usePageTitle(publicPageTitle('Profile'));
  return <GuestProfileForm />;
}
