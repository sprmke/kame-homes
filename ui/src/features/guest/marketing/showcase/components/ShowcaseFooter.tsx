import { Mail, MapPin, Phone } from 'lucide-react';

import { isLegacyKameHomeBrand } from '@/features/guest/form/lib/guestFormBranding';
import { HostPublicSocialLinks } from '@/features/guest/marketing/hosts/components/HostPublicSocialLinks';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import {
  formatShowcaseAddress,
  formatShowcaseMapsLink,
} from '@/features/guest/marketing/showcase/lib/showcaseLocation';
import { scrollShowcaseToTop } from '@/features/guest/marketing/showcase/lib/showcaseScroll';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

const footerLabelClass =
  'text-xs font-semibold uppercase tracking-[0.14em] text-inherit opacity-70';
const footerBodyClass = 'text-base leading-relaxed';

export function ShowcaseFooter({ data }: { data: ShowcaseData }) {
  const { tokens } = useShowcaseTheme();
  const fullAddress = formatShowcaseAddress(data);
  const mapsLink = formatShowcaseMapsLink(data);
  const { guestContact, host } = data;
  const phone = guestContact.contactPhone.trim();
  const email = guestContact.contactEmail.trim();
  const hostLabel = guestContact.contactName || host.ownerName;
  const rawOrg = host.organizationName.trim();
  const orgLabel = !rawOrg || rawOrg === 'Host' || isLegacyKameHomeBrand(rawOrg) ? '' : rawOrg;
  const showOrgLabel = Boolean(orgLabel);

  return (
    <footer className={cn('@sm:py-16 border-t py-14', tokens.footer, 'font-sans antialiased')}>
      <div className="@lg:grid-cols-3 @sm:px-6 @lg:px-8 @sm:gap-12 mx-auto grid max-w-6xl gap-10 px-4">
        <div className="min-w-0 space-y-4">
          <button
            type="button"
            onClick={() => scrollShowcaseToTop()}
            className="flex min-h-11 cursor-pointer items-center gap-3 text-left"
            aria-label="Back to top"
          >
            {data.logoUrl ? (
              <span
                className={cn('size-12 shrink-0 overflow-hidden rounded-lg', tokens.brandLogoBg)}
              >
                <img
                  src={data.logoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover object-center"
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="@sm:text-xl truncate text-lg font-semibold tracking-tight">
                {data.propertyName}
              </p>
              <p className={cn('truncate text-base', tokens.muted)}>
                {showOrgLabel ? orgLabel : data.locationLabel}
              </p>
            </div>
          </button>
        </div>

        <div className="@sm:space-y-4 space-y-3">
          <p className={footerLabelClass}>Host</p>
          <p className={cn(footerBodyClass, tokens.body)}>{hostLabel}</p>
        </div>

        <div className="@sm:space-y-4 space-y-3">
          <p className={footerLabelClass}>Contact</p>
          {fullAddress ? (
            <p className={cn('flex items-start gap-2.5 text-base leading-relaxed', tokens.muted)}>
              <MapPin className="mt-1 size-[1.125rem] shrink-0" aria-hidden />
              <span>
                {mapsLink ? (
                  <a href={mapsLink} target="_blank" rel="noreferrer" className="hover:underline">
                    {fullAddress}
                  </a>
                ) : (
                  fullAddress
                )}
              </span>
            </p>
          ) : null}
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className={cn('flex min-h-11 items-center gap-2.5', footerBodyClass, tokens.body)}
            >
              <Phone className="size-[1.125rem] shrink-0" aria-hidden />
              {phone}
            </a>
          ) : null}
          {email ? (
            <a
              href={`mailto:${email}`}
              className={cn(
                'flex min-h-11 items-center gap-2.5 break-all',
                footerBodyClass,
                tokens.body
              )}
            >
              <Mail className="size-[1.125rem] shrink-0" aria-hidden />
              {email}
            </a>
          ) : null}
          <HostPublicSocialLinks links={guestContact.socialLinks} />
        </div>
      </div>
    </footer>
  );
}
