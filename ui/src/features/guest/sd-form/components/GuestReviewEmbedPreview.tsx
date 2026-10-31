import { Star } from 'lucide-react';

import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';

const GUEST_REVIEW_BRAND_TITLE = 'Guest Review';

/** Dashboard Public Pages iframe — guest review step before SD refund. */
export function GuestReviewEmbedPreview() {
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);

  return (
    <div className="relative space-y-6 p-4 sm:p-6 lg:p-8">
      <GuestFormBrandHeader {...brandHeader} title={GUEST_REVIEW_BRAND_TITLE} />

      <div className="border-primary/10 from-primary/[0.04] via-card to-muted/15 mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border bg-gradient-to-b px-4 py-6 sm:px-6">
        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Rating</p>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="text-primary/35 size-8" aria-hidden />
          ))}
        </div>
        <div className="bg-muted h-24 w-full rounded-lg" aria-hidden />
      </div>
    </div>
  );
}
