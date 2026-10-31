import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { ArrowUpRight, Mail, MapPin, Navigation, Phone } from 'lucide-react';

import { HostPublicSocialLinks } from '@/features/guest/marketing/hosts/components/HostPublicSocialLinks';
import { ShowcaseMapEmbed } from '@/features/guest/marketing/showcase/components/ShowcaseMapEmbed';
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import {
  formatShowcaseAddress,
  formatShowcaseMapsLink,
  formatShowcaseStreetLine,
  shouldShowShowcaseStreetLine,
} from '@/features/guest/marketing/showcase/lib/showcaseLocation';
import { resolveShowcaseMotionReduced } from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

/* ============================================================= *
 * Shared building blocks for the Verso / Atlas / Haven templates.
 * Kept separate from ShowcaseLocationSection / ShowcaseHostSection
 * so the original three templates are untouched.
 * ============================================================= */

type LocationPanelProps = {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  /** Wrapper for the whole section. */
  className?: string;
  /** Container padding + width. */
  innerClassName?: string;
  headingClassName?: string;
  eyebrow?: ReactNode;
  /** Map frame: border radius / border / shadow. */
  frameClassName?: string;
  /** Map aspect ratio. */
  mapAspectClassName?: string;
  /** Directions button styling (appended after a shared base). */
  actionClassName?: string;
};

export function ShowcaseLocationPanel({
  data,
  section,
  className,
  innerClassName = 'mx-auto max-w-6xl px-5 @md:px-8',
  headingClassName = 'text-3xl @sm:text-4xl font-semibold tracking-tight',
  eyebrow,
  frameClassName = 'rounded-2xl border',
  mapAspectClassName = 'aspect-[16/10] @md:aspect-[2/1]',
  actionClassName,
}: LocationPanelProps) {
  const { tokens } = useShowcaseTheme();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const lead = data.locationLead.trim();
  const streetLine = formatShowcaseStreetLine(data);
  const showStreet = shouldShowShowcaseStreetLine(lead, streetLine);
  const mapQuery = formatShowcaseAddress(data);
  const mapsLink = formatShowcaseMapsLink(data);
  const customBody = section.body?.trim() ?? '';
  const showCustomBody =
    customBody.length > 0 &&
    customBody !== streetLine &&
    customBody !== lead &&
    !lead.toLowerCase().includes(customBody.toLowerCase());

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn('scroll-mt-24', className)}
    >
      <div className={innerClassName}>
        <ShowcaseReveal reduced={motionReduced}>
          {eyebrow}
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={headingClassName}
            usesPreviewMock={section.usesPreviewMock}
          />
          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-base',
              tokens.body
            )}
          >
            {lead ? <span className="font-medium">{lead}</span> : null}
            {showStreet ? <span className={tokens.muted}>{streetLine}</span> : null}
          </div>
          {showCustomBody ? (
            <p className={cn('mt-3 max-w-xl text-base leading-relaxed', tokens.body)}>
              {customBody}
            </p>
          ) : null}
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.08} className="mt-7">
          <div className={cn('overflow-hidden', frameClassName, tokens.cardBorder)}>
            <div className={cn('relative w-full', mapAspectClassName)}>
              <ShowcaseMapEmbed
                className="absolute inset-0 size-full"
                latitude={data.latitude}
                longitude={data.longitude}
                placeId={data.placeId}
                address={mapQuery}
              />
            </div>
          </div>
          {mapsLink ? (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'mt-4 inline-flex min-h-11 items-center gap-2 px-5 text-sm font-medium',
                tokens.primaryBtn,
                actionClassName
              )}
            >
              <Navigation className="size-4" aria-hidden />
              Get directions
            </a>
          ) : null}
        </ShowcaseReveal>
      </div>
    </section>
  );
}

type ContactPanelProps = {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  className?: string;
  innerClassName?: string;
  headingClassName?: string;
  eyebrow?: ReactNode;
  /** Avatar shape (border radius). */
  avatarClassName?: string;
  /** Contact chip styling (appended after a shared base). */
  chipClassName?: string;
};

export function ShowcaseContactPanel({
  data,
  section,
  className,
  innerClassName = 'mx-auto max-w-6xl px-5 @md:px-8',
  headingClassName = 'text-3xl @sm:text-4xl font-semibold tracking-tight',
  eyebrow,
  avatarClassName = 'rounded-2xl',
  chipClassName,
}: ContactPanelProps) {
  const { tokens } = useShowcaseTheme();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const { host, guestContact } = data;
  const avatar = host.ownerAvatarUrl || host.organizationLogoUrl;
  const displayName = guestContact.contactName || host.ownerName;
  const phone = guestContact.contactPhone.trim();
  const email = guestContact.contactEmail.trim();
  const blurb = section.body?.trim() || section.subheading?.trim();

  const chipBase = cn(
    'inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-medium',
    tokens.secondaryBtn,
    chipClassName
  );

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn('scroll-mt-24', className)}
    >
      <div className={innerClassName}>
        <ShowcaseReveal reduced={motionReduced}>
          {eyebrow}
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={headingClassName}
            usesPreviewMock={section.usesPreviewMock}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.06} className="mt-7">
          <div className="@lg:grid-cols-[7rem_1fr] @lg:gap-9 grid grid-cols-1 gap-6">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn('size-24 shrink-0 object-cover', avatarClassName, tokens.brandLogoBg)}
              />
            ) : (
              <span
                className={cn(
                  'inline-flex size-24 shrink-0 items-center justify-center text-2xl font-bold',
                  avatarClassName,
                  tokens.brandFallback
                )}
              >
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-lg font-semibold">{displayName}</p>
                <p className={cn('text-base', tokens.muted)}>{host.organizationName}</p>
                {host.verifiedBadge ? (
                  <p className="text-primary mt-1 text-sm font-medium">Verified host</p>
                ) : null}
              </div>

              {blurb ? (
                <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>{blurb}</p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {phone ? (
                  <a href={`tel:${phone.replace(/\s/g, '')}`} className={chipBase}>
                    <Phone className="size-4" aria-hidden />
                    {phone}
                  </a>
                ) : null}
                {email ? (
                  <a href={`mailto:${email}`} className={cn(chipBase, 'break-all')}>
                    <Mail className="size-4" aria-hidden />
                    {email}
                  </a>
                ) : null}
                {data.hostPublicPath ? (
                  <Link
                    to={data.hostPublicPath}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-1.5 px-5 text-sm font-medium',
                      tokens.primaryBtn,
                      chipClassName
                    )}
                  >
                    View host
                    <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
                <Link to={data.contactPath} className={chipBase}>
                  <MapPin className="size-4" aria-hidden />
                  Message host
                </Link>
              </div>

              <HostPublicSocialLinks links={guestContact.socialLinks} />
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </section>
  );
}
