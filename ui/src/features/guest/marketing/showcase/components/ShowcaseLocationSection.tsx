import { Navigation } from 'lucide-react';

import { ShowcaseMapEmbed } from '@/features/guest/marketing/showcase/components/ShowcaseMapEmbed';
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { useShowcaseStyle } from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import {
  formatShowcaseAddress,
  formatShowcaseMapsLink,
  formatShowcaseStreetLine,
  hasShowcaseLocationContent,
  shouldShowShowcaseStreetLine,
} from '@/features/guest/marketing/showcase/lib/showcaseLocation';
import { showcaseSectionPyClass } from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import { resolveShowcaseMotionReduced } from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

type Props = {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  headingClassName?: string;
  layout?: 'split' | 'stack';
};

function openDirections(data: ShowcaseData) {
  const link = formatShowcaseMapsLink(data);
  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer');
  }
}

export function ShowcaseLocationSection({
  data,
  section,
  headingClassName,
  layout = 'split',
}: Props) {
  const { tokens } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const lead = data.locationLead.trim();
  const streetLine = formatShowcaseStreetLine(data);
  const mapQuery = formatShowcaseAddress(data);
  const showStreet = shouldShowShowcaseStreetLine(lead, streetLine);
  const customBody = section.body?.trim() ?? '';
  const isPreviewLocationCopy = customBody.includes(
    'Directions and address details come from property settings'
  );
  const showCustomBody =
    customBody.length > 0 &&
    !isPreviewLocationCopy &&
    customBody !== streetLine &&
    customBody !== lead &&
    !lead.toLowerCase().includes(customBody.toLowerCase());
  const showPreviewBanner = section.usesPreviewMock && !hasShowcaseLocationContent(data);

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn('scroll-mt-20', showcaseSectionPyClass)}
    >
      <div
        className={cn(
          '@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4',
          layout === 'split' && '@lg:grid-cols-2 @lg:items-start grid gap-8'
        )}
      >
        <ShowcaseReveal reduced={motionReduced}>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn(
              displayFontClass,
              headingClassName ?? '@sm:text-4xl text-3xl font-semibold tracking-tight'
            )}
            usesPreviewMock={showPreviewBanner}
          />
          {lead ? <p className={cn('mt-3 text-base font-medium', tokens.body)}>{lead}</p> : null}
          {showStreet ? (
            <p className={cn('mt-2 max-w-md text-base leading-relaxed', tokens.muted)}>
              {streetLine}
            </p>
          ) : null}
          {showCustomBody ? (
            <p className={cn('mt-3 max-w-md text-base leading-relaxed', tokens.body)}>
              {customBody}
            </p>
          ) : null}
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.08}>
          <div className="relative overflow-hidden rounded-2xl">
            <div className="@sm:min-h-[360px] relative min-h-[260px]">
              <ShowcaseMapEmbed
                className="absolute inset-0 size-full"
                latitude={data.latitude}
                longitude={data.longitude}
                placeId={data.placeId}
                mapsUrl={data.mapsUrl}
                address={mapQuery}
              />
            </div>
            <button
              type="button"
              onClick={() => openDirections(data)}
              className={cn(
                'absolute bottom-4 left-4 z-10 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium shadow-md',
                tokens.primaryBtn
              )}
            >
              <Navigation className="size-4" aria-hidden />
              Directions
            </button>
          </div>
        </ShowcaseReveal>
      </div>
    </section>
  );
}
