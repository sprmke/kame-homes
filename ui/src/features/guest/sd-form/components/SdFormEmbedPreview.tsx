import { Star } from 'lucide-react';

import { GuestFormStepper } from '@/features/guest/form/components/GuestFormStepper';
import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';
import { SD_FORM_STEPS } from '@/features/guest/sd-form/lib/sdFormSteps';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';

const SD_FORM_BRAND_TITLE = 'SD Refund Form';

/** Dashboard Public Pages iframe — same shell as the live SD refund form. */
export function SdFormEmbedPreview() {
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);

  return (
    <div className="relative space-y-6 p-4 sm:p-6 lg:p-8">
      <GuestFormBrandHeader {...brandHeader} title={SD_FORM_BRAND_TITLE} />
      <GuestFormStepper activeStep={1} steps={SD_FORM_STEPS} />

      <header className="border-separator space-y-4 border-b px-5 pb-5">
        <h1 className="text-foreground text-base font-bold sm:text-lg">Hi Guest,</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          How was your stay? You can skip this and still get your refund.
        </p>
      </header>

      <div className="px-5 sm:px-6">
        <div className="border-primary/10 from-primary/[0.04] via-card to-muted/15 flex flex-col items-center gap-4 rounded-xl border bg-gradient-to-b px-4 py-6 sm:px-6">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Rating</p>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="text-primary/35 size-8" aria-hidden />
            ))}
          </div>
          <div className="bg-muted h-20 w-full rounded-lg" aria-hidden />
        </div>
      </div>
    </div>
  );
}
