import { Car } from 'lucide-react';

import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';

/** Dashboard Public Pages iframe — stay-scoped marketplace find entry (replaces vehicle form). */
export function PayParkingEmbedPreview() {
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);

  return (
    <div className="relative space-y-6 p-4 sm:p-6 lg:p-8">
      <GuestFormBrandHeader {...brandHeader} title="Find parking" />

      <section className="form-section !px-4 !py-5 sm:!px-5 sm:!py-6">
        <div className="form-section-header">
          <Car className="form-section-icon" aria-hidden />
          <h2 className="form-section-title !text-base sm:!text-lg">Marketplace</h2>
        </div>
        <div className="bg-muted mt-4 h-40 w-full rounded-xl" aria-hidden />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="bg-muted h-24 rounded-lg" aria-hidden />
          <div className="bg-muted h-24 rounded-lg" aria-hidden />
          <div className="bg-muted hidden h-24 rounded-lg sm:block" aria-hidden />
        </div>
      </section>
    </div>
  );
}
