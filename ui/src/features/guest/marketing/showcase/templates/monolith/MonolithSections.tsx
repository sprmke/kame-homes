import { useMemo } from 'react';

import { motion } from 'framer-motion';

import { ShowcaseCanvas } from '@/features/guest/marketing/showcase/components/ShowcaseCanvas';
import {
  ShowcaseCtaActions,
  primaryButtonClass,
  secondaryButtonClass,
  showcaseCtaBaseClass,
} from '@/features/guest/marketing/showcase/components/ShowcaseCtaActions';
import { ShowcaseGalleryCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseGalleryCarousel';
import { ShowcaseLocationSection } from '@/features/guest/marketing/showcase/components/ShowcaseLocationSection';
import {
  AmenityMarquee,
  AnimatedStat,
  ShowcaseReveal,
} from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcaseReviewsCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseReviewsCarousel';
import { ShowcaseSectionIntro } from '@/features/guest/marketing/showcase/components/ShowcaseSectionIntro';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseMediaPalette } from '@/features/guest/marketing/showcase/hooks/useShowcaseMediaPalette';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import {
  showcaseHeroContentTopClass,
  showcaseHeroSectionClass,
} from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';
import { collectShowcaseMediaUrls } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import { resolveShowcasePaletteAccent } from '@/features/guest/marketing/showcase/lib/showcasePaletteSurfaces';
import {
  parseShowcaseHighlight,
  resolveShowcaseGridColsClass,
  resolveShowcasePrimaryCtaHref,
  resolveShowcaseSecondaryCtaHref,
  resolveShowcaseSecondaryCtaLabel,
  showcaseCtaSectionPyClass,
  showcaseSectionPyClass,
  shouldRenderShowcaseSection,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import { resolveShowcaseSpotlightEnabled } from '@/features/guest/marketing/showcase/lib/showcaseSpotlight';
import {
  resolveShowcaseCanvasPaused,
  resolveShowcaseHeroOverlayClass,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import {
  monolithDisplayFontClass,
  monolithHeroTitleClass,
  monolithSectionTitleClass,
} from '@/features/guest/marketing/showcase/templates/monolith/monolithTypography';
import { useMonolithHeroSpotlight } from '@/features/guest/marketing/showcase/templates/monolith/useMonolithHeroSpotlight';
import { MonolithHostSection } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseHostSections';
import { StayGuideTemplatedSection } from '@/features/guest/marketing/showcase/templates/shared/StayGuideSections';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

function monolithHeadingClass() {
  return cn(monolithDisplayFontClass, monolithSectionTitleClass);
}

function SpotlightHero({
  data,
  section,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
}) {
  const { tokens, variant, mode: themeMode } = useShowcaseTheme();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const hasImage = Boolean(section.images[0]);
  const mediaEnabled = data.config.palette.mode === 'media';
  const mediaUrls = useMemo(() => collectShowcaseMediaUrls(data), [data]);
  const { palette: mediaPalette } = useShowcaseMediaPalette(mediaUrls, mediaEnabled);
  const resolvedAccent = resolveShowcasePaletteAccent(
    data.config.palette.mode,
    themeMode,
    data.accentColor,
    mediaPalette,
    data.brandColor,
    data.config.palette.customPaletteBase
  );
  const spotlightEnabled = resolveShowcaseSpotlightEnabled(data.config, data.reducedMotion);
  const { elRef, spotlight, onPointerEnter, onPointerMove, onPointerDown, onPointerLeave } =
    useMonolithHeroSpotlight(spotlightEnabled, resolvedAccent, hasImage);
  const canvasOff = resolveShowcaseCanvasPaused(data.config, data.reducedMotion);
  const overlayClass = resolveShowcaseHeroOverlayClass(data.config.palette.overlay);

  return (
    <section
      ref={elRef}
      id={section.id}
      data-page-editor-anchor={section.id}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
      className={cn(
        'group relative flex scroll-mt-20 flex-col justify-end overflow-hidden',
        showcaseHeroSectionClass(containedChrome),
        hasImage ? 'bg-neutral-950 text-neutral-50' : tokens.page,
        spotlightEnabled && 'cursor-crosshair touch-manipulation'
      )}
    >
      {section.images[0] ? (
        <img
          src={section.images[0]}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-45 transition-[transform,opacity] duration-700 ease-out motion-safe:group-hover:scale-[1.02]"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
      ) : null}
      <ShowcaseCanvas variant="grain" paused={canvasOff} className="opacity-70" />
      {hasImage ? <div className={cn('absolute inset-0 bg-gradient-to-t', overlayClass)} /> : null}
      {spotlightEnabled ? (
        <motion.div
          className={cn(
            'pointer-events-none absolute inset-0 z-[1]',
            hasImage ? 'mix-blend-screen' : 'mix-blend-soft-light'
          )}
          style={{ background: spotlight }}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          '@sm:px-6 @lg:px-8 relative z-10 mx-auto w-full max-w-6xl px-4 pb-14',
          showcaseHeroContentTopClass(containedChrome),
          '@sm:pb-16'
        )}
      >
        <p
          className={cn(
            'text-sm uppercase tracking-[0.2em]',
            hasImage ? 'text-white/60' : tokens.muted
          )}
        >
          {data.heroEyebrow}
        </p>
        <h1 className={cn(monolithDisplayFontClass, monolithHeroTitleClass, 'mt-3 max-w-5xl')}>
          {section.heading === 'Your stay' ? data.propertyName : section.heading}
        </h1>
        {section.subheading ? (
          <p
            className={cn(
              '@sm:text-lg mt-4 max-w-xl text-base leading-relaxed',
              hasImage ? 'text-white/80' : tokens.body
            )}
          >
            {section.subheading}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <ShowcaseSectionLink
            to={resolveShowcasePrimaryCtaHref(section.ctaTarget, data)}
            className={cn(showcaseCtaBaseClass, primaryButtonClass(variant, themeMode))}
          >
            {section.ctaLabel || 'Request stay'}
          </ShowcaseSectionLink>
          <ShowcaseSectionLink
            to={resolveShowcaseSecondaryCtaHref(data)}
            className={cn(
              showcaseCtaBaseClass,
              hasImage
                ? 'rounded-none border border-white/35 bg-white/10 uppercase tracking-[0.12em] text-white backdrop-blur-sm'
                : secondaryButtonClass(variant, themeMode)
            )}
          >
            {resolveShowcaseSecondaryCtaLabel(data)}
          </ShowcaseSectionLink>
        </div>
      </div>
      {data.amenities.length > 0 ? (
        <div className="relative z-10">
          <AmenityMarquee
            items={data.amenities.slice(0, 12)}
            borderClassName={tokens.marqueeBorder}
          />
        </div>
      ) : null}
    </section>
  );
}

export function MonolithSections({ data }: { data: ShowcaseData }) {
  const { tokens } = useShowcaseTheme();
  const sectionHeadingClass = monolithHeadingClass();
  const hero = data.sections.find((s) => s.id === 'hero');

  return (
    <div className="font-sans">
      {hero ? <SpotlightHero data={data} section={hero} /> : null}

      {data.sections
        .filter((s) => s.id !== 'hero' && shouldRenderShowcaseSection(s, data))
        .map((section, index) => {
          if (data.pageKind === 'stay-guide' && section.kind !== 'gallery') {
            return (
              <StayGuideTemplatedSection
                key={section.id}
                data={data}
                section={section}
                alt={index % 2 === 1}
                headingClassName="font-instrument"
                containerClassName="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4"
              />
            );
          }
          if (section.id === 'gallery') {
            return (
              <section
                key={section.id}
                id={section.id}
                data-page-editor-anchor={section.id}
                className={cn(
                  'scroll-mt-20 border-t',
                  showcaseSectionPyClass,
                  tokens.sectionBorder
                )}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={sectionHeadingClass}
                      tokens={tokens}
                      showBody={false}
                    />
                  </ShowcaseReveal>
                  <div className={cn('relative mt-5 overflow-hidden border', tokens.galleryFrame)}>
                    <ShowcaseGalleryCarousel
                      images={section.images}
                      propertyName={data.propertyName}
                      variant="monolith"
                      chrome="overlay"
                      imageClassName={tokens.galleryImageBorder}
                    />
                  </div>
                </div>
              </section>
            );
          }

          if (section.id === 'highlights') {
            return (
              <section
                key={section.id}
                id={section.id}
                data-page-editor-anchor={section.id}
                className={cn(
                  'scroll-mt-20 border-t',
                  showcaseSectionPyClass,
                  tokens.sectionBorder
                )}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={sectionHeadingClass}
                      tokens={tokens}
                    />
                  </ShowcaseReveal>
                  <div
                    className={cn(resolveShowcaseGridColsClass(section.columns, 4), 'mt-5 gap-6')}
                  >
                    {data.highlights.map((item) => {
                      const { value, label } = parseShowcaseHighlight(item);
                      return (
                        <AnimatedStat
                          key={item}
                          value={value ?? label}
                          label={value ? label : ''}
                          reduced={data.reducedMotion}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          }

          if (section.id === 'amenities') {
            return (
              <section
                key={section.id}
                id={section.id}
                data-page-editor-anchor={section.id}
                className={cn(
                  'scroll-mt-20 border-t',
                  showcaseSectionPyClass,
                  tokens.sectionBorder
                )}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={sectionHeadingClass}
                      tokens={tokens}
                    />
                  </ShowcaseReveal>
                  <ul
                    className={cn(
                      resolveShowcaseGridColsClass(section.columns, 2),
                      'mt-5 gap-0 border',
                      tokens.cardBorder
                    )}
                  >
                    {data.amenities.map((item) => (
                      <li key={item} className={cn('min-w-0 text-base', tokens.amenityCell)}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          }

          if (section.id === 'cta') {
            return (
              <section
                key={section.id}
                id={section.id}
                data-page-editor-anchor={section.id}
                className={cn(
                  'scroll-mt-20 border-t',
                  showcaseCtaSectionPyClass,
                  tokens.sectionBorder
                )}
              >
                <div
                  className={cn(
                    '@sm:px-10 @sm:py-14 mx-auto max-w-5xl px-4 py-10 text-center',
                    tokens.ctaSurface
                  )}
                >
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={sectionHeadingClass}
                      tokens={tokens}
                      showBody={false}
                      align="center"
                    />
                    <ShowcaseCtaActions
                      data={data}
                      ctaLabel={section.ctaLabel}
                      ctaTarget={section.ctaTarget}
                      primaryLabel="Book now"
                      className="mt-6"
                    />
                  </ShowcaseReveal>
                </div>
              </section>
            );
          }

          if (section.id === 'location') {
            return (
              <ShowcaseLocationSection
                key={section.id}
                data={data}
                section={section}
                headingClassName={sectionHeadingClass}
              />
            );
          }

          if (section.id === 'host') {
            return (
              <MonolithHostSection
                key={section.id}
                data={data}
                section={section}
                headingClassName={sectionHeadingClass}
              />
            );
          }

          return (
            <MonolithGeneric
              key={section.id}
              data={data}
              section={section}
              index={index}
              sectionHeadingClass={sectionHeadingClass}
            />
          );
        })}
    </div>
  );
}

function MonolithGeneric({
  data,
  section,
  index,
  sectionHeadingClass,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  index: number;
  sectionHeadingClass: string;
}) {
  const { tokens } = useShowcaseTheme();

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        'scroll-mt-20 border-t',
        showcaseSectionPyClass,
        tokens.sectionBorder,
        index % 2 === 1 && tokens.sectionAlt
      )}
    >
      <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
        <ShowcaseReveal reduced={data.reducedMotion}>
          <ShowcaseSectionIntro
            section={section}
            headingClassName={sectionHeadingClass}
            tokens={tokens}
            showBody={section.id !== 'testimonials'}
          />
        </ShowcaseReveal>
        {section.id === 'testimonials' ? (
          <ShowcaseReviewsCarousel
            reviews={data.testimonials}
            variant="monolith"
            className="mt-5"
          />
        ) : null}
      </div>
    </section>
  );
}
