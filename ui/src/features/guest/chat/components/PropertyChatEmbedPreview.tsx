import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { pickGuestBrandHeaderProps } from '@/features/guest/form/lib/guestFormBranding';
import { GuestStayContextBar } from '@/features/guest/property/components/GuestStayContextBar';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';

type Props = {
  checkInDate: string;
  checkOutDate: string;
};

/** Dashboard Public Pages iframe — same MainLayout shell as calendar/form. */
export function PropertyChatEmbedPreview({ checkInDate, checkOutDate }: Props) {
  const { data: guestBrand = DEFAULT_GUEST_PAYMENT_INFO } = useGuestPaymentInfo();
  const brandHeader = pickGuestBrandHeaderProps(guestBrand);
  const hostLabel = guestBrand.organizationName?.trim() || 'Host';
  const propertyName = guestBrand.propertyName?.trim() || 'Property';

  return (
    <div className="guest-inner-enter relative min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <GuestFormBrandHeader {...brandHeader} title="Messages" />

      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <div className="border-border bg-card flex flex-col overflow-hidden sm:rounded-3xl sm:border">
          <div className="border-border flex items-center gap-2.5 border-b px-3 py-2.5">
            <span className="from-primary to-primary/80 flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white">
              {hostLabel.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-semibold">{hostLabel}</p>
              <p className="text-muted-foreground truncate text-xs">{propertyName}</p>
            </div>
          </div>

          <div className="border-border border-b px-3 py-2">
            <GuestStayContextBar
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              width="full"
              density="compact"
            />
          </div>

          <div className="flex min-h-[14rem] flex-col justify-end gap-2.5 p-3 sm:min-h-[16rem] sm:p-4">
            <p className="bg-muted text-muted-foreground max-w-[78%] self-start rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-snug">
              Hi, is this available?
            </p>
            <p className="bg-primary-strong text-primary-foreground max-w-[72%] self-end rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-snug">
              Yes — send dates and we&apos;ll confirm.
            </p>
          </div>

          <div className="border-border border-t p-3">
            <div className="bg-muted h-10 w-full rounded-full" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
