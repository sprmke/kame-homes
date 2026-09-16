import { useRef } from 'react';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import { ShowcaseCanvas } from '@/features/guest/marketing/showcase/components/ShowcaseCanvas';
import {
  ShowcaseCtaActions,
  primaryButtonClass,
  showcaseCtaBaseClass,
} from '@/features/guest/marketing/showcase/components/ShowcaseCtaActions';
import { ShowcaseGalleryCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseGalleryCarousel';
import { ShowcaseLocationSection } from '@/features/guest/marketing/showcase/components/ShowcaseLocationSection';
import { ShowcasePreviewMockBanner } from '@/features/guest/marketing/showcase/components/ShowcasePreviewMockBanner';
import { ShowcaseReviewsCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseReviewsCarousel';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { ShowcaseSectionIntro } from '@/features/guest/marketing/showcase/components/ShowcaseSectionIntro';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseStyle } from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useSmoothScroll } from '@/features/guest/marketing/showcase/components/SmoothScrollProvider';
import { useScrollSpy } from '@/features/guest/marketing/showcase/hooks/useScrollSpy';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import {
  showcaseHeroContentTopClass,
  showcaseHeroSectionClass,
} from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';
import {
  resolveShowcaseGridColsClass,
  resolveShowcasePrimaryCtaHref,
  resolveShowcaseSecondaryCtaHref,
  resolveShowcaseSecondaryCtaLabel,
  showcaseCtaInnerPyClass,
  showcaseCtaSectionPyClass,
  showcaseSectionPyClass,
  shouldRenderShowcaseSection,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import {
  resolveShowcaseCanvasPaused,
  resolveShowcaseHeroOverlayClass,
  resolveShowcaseParallaxEnabled,
  resolveShowcaseMotionReduced,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import {
  AuroraParallaxContainer,
  AuroraParallaxLayer,
  AuroraParallaxReveal,
  AuroraParallaxSection,
} from '@/features/guest/marketing/showcase/templates/aurora/AuroraParallaxSection';
import {
  useAuroraHeroParallax,
  AURORA_HERO_IMAGE_OVERSCALE,
  AURORA_HERO_MESH_OVERSCALE,
} from '@/features/guest/marketing/showcase/templates/aurora/useAuroraHeroParallax';
import { AuroraHostSection } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseHostSections';
import { StayGuideTemplatedSection } from '@/features/guest/marketing/showcase/templates/shared/StayGuideSections';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

function ProgressRail({ data }: { data: ShowcaseData }) {
  const { scrollToAnchor } = useSmoothScroll();
  const { tokens } = useShowcaseTheme();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const ids = data.sections.map((s) => s.id);
  const active = useScrollSpy(ids);

  if (containedChrome) return null;

  return (
    <aside
      className="@lg:block pointer-events-none fixed right-4 top-1/2 z-30 hidden -translate-y-1/2"
      aria-label="Section progress"
    >
      <div className="pointer-events-auto flex flex-col gap-2">
        {data.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToAnchor(section.id)}
            className={cn(
              'h-8 w-1.5 cursor-pointer rounded-full transition-all duration-300',
              active === section.id ? tokens.progressActive : tokens.progressInactive
            )}
            aria-label={`Go to ${section.heading}`}
          />
        ))}
      </div>
    </aside>
  );
}

function AuroraHero({ data, section }: { data: ShowcaseData; section: ShowcaseResolvedSection }) {
  const { tokens, mode } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const ref = useRef<HTMLElement>(null);
  const canvasOff = resolveShowcaseCanvasPaused(data.config, data.reducedMotion);
  const parallaxEnabled = resolveShowcaseParallaxEnabled(
    data.config,
    data.reducedMotion,
    data.embed
  );
  const parallax = useAuroraHeroParallax(ref, {
    enabled: parallaxEnabled,
    intensity: data.config.motion.intensity,
    contained: containedChrome,
    embed: data.embed,
  });
  const overlayClass = resolveShowcaseHeroOverlayClass(data.config.palette.overlay);
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const heroEnter = !motionReduced;

  return (
    <section
      ref={ref}
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        'relative flex scroll-mt-20 flex-col justify-end overflow-hidden',
        showcaseHeroSectionClass(containedChrome)
      )}
    >
      {section.images[0] ? (
        <motion.div
          className={cn(
            'absolute inset-0 origin-center',
            parallaxEnabled && 'will-change-transform'
          )}
          style={
            parallaxEnabled
              ? {
                  y: parallax.imageY,
                  scale: AURORA_HERO_IMAGE_OVERSCALE,
                }
              : { scale: AURORA_HERO_IMAGE_OVERSCALE }
          }
        >
          <img
            src={section.images[0]}
            alt=""
            className="size-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="sync"
          />
        </motion.div>
      ) : (
        <div className="from-primary/30 via-background to-muted absolute inset-0 bg-gradient-to-br" />
      )}
      {parallaxEnabled ? (
        <motion.div
          className="bg-primary/25 pointer-events-none absolute -left-1/4 top-1/4 size-[min(520px,70vw)] rounded-full blur-3xl"
          style={{ y: parallax.glowY, opacity: 0.55 }}
          aria-hidden
        />
      ) : null}
      <motion.div
        className={cn('absolute inset-0', parallaxEnabled && 'will-change-transform')}
        style={
          parallaxEnabled
            ? { y: parallax.meshY, scale: AURORA_HERO_MESH_OVERSCALE }
            : { scale: AURORA_HERO_MESH_OVERSCALE }
        }
        aria-hidden
      >
        <ShowcaseCanvas variant="mesh" paused={canvasOff} />
      </motion.div>
      <div className={cn('absolute inset-0 bg-gradient-to-t', overlayClass)} />
      {parallaxEnabled ? (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ opacity: parallax.overlayLift }}
          aria-hidden
        />
      ) : null}
      <motion.div
        className={cn(
          '@sm:px-6 @sm:pb-20 @lg:px-8 relative z-10 mx-auto w-full max-w-6xl px-4 pb-16',
          showcaseHeroContentTopClass(containedChrome),
          parallaxEnabled && 'will-change-transform'
        )}
        style={
          parallaxEnabled ? { y: parallax.contentY, opacity: parallax.contentOpacity } : undefined
        }
        initial={heroEnter ? 'hidden' : false}
        animate={heroEnter ? 'show' : undefined}
        variants={
          heroEnter
            ? {
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.09, delayChildren: 0.08 },
                },
              }
            : undefined
        }
      >
        <motion.p
          className="mb-3 max-w-xl text-base text-white/80"
          variants={
            heroEnter ? { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } } : undefined
          }
        >
          {data.heroEyebrow}
        </motion.p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <motion.h1
            className={cn(
              displayFontClass,
              '@sm:text-5xl @lg:text-[5rem] @lg:leading-[0.95] max-w-4xl text-[clamp(1.75rem,8vw,2.5rem)] font-semibold tracking-[-0.03em] text-white'
            )}
            variants={
              heroEnter ? { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0 } } : undefined
            }
          >
            {section.heading === 'Your stay' ? data.propertyName : section.heading}
          </motion.h1>
          {section.usesPreviewMock ? <ShowcasePreviewMockBanner variant="onDark" /> : null}
        </div>
        {section.subheading ? (
          <motion.p
            className="@sm:text-lg mt-4 max-w-xl text-base leading-relaxed text-white/90"
            variants={
              heroEnter ? { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } } : undefined
            }
          >
            {section.subheading}
          </motion.p>
        ) : null}
        <motion.div
          className="mt-8 flex flex-wrap gap-3"
          variants={
            heroEnter ? { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } } : undefined
          }
        >
          <ShowcaseSectionLink
            to={resolveShowcasePrimaryCtaHref(section.ctaTarget, data)}
            className={cn(showcaseCtaBaseClass, primaryButtonClass('aurora', mode))}
          >
            {section.ctaLabel || 'Request stay'}
          </ShowcaseSectionLink>
          <ShowcaseSectionLink
            to={resolveShowcaseSecondaryCtaHref(data)}
            className={cn(showcaseCtaBaseClass, 'rounded-full', tokens.heroSecondaryBtn)}
          >
            {resolveShowcaseSecondaryCtaLabel(data)}
          </ShowcaseSectionLink>
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-white/70"
        style={parallaxEnabled ? { opacity: parallax.cueOpacity } : undefined}
        animate={data.reducedMotion ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
      >
        <ChevronDown className="size-5" aria-hidden />
      </motion.div>
    </section>
  );
}

function GenericSection({
  data,
  section,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
}) {
  const { tokens } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();

  return (
    <AuroraParallaxSection id={section.id} data={data} className={showcaseSectionPyClass}>
      <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
        <AuroraParallaxReveal layer="intro">
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn(
              displayFontClass,
              '@sm:text-4xl text-3xl font-semibold tracking-tight'
            )}
            usesPreviewMock={section.usesPreviewMock}
          />
          {section.subheading ? (
            <p className={cn('mt-2 max-w-2xl text-base leading-relaxed', tokens.subheading)}>
              {section.subheading}
            </p>
          ) : null}
        </AuroraParallaxReveal>
        {section.id === 'highlights' ? (
          <AuroraParallaxLayer layer="content">
            <>
              {section.body ? (
                <p
                  className={cn(
                    '@sm:text-lg mt-5 max-w-2xl text-base leading-relaxed',
                    tokens.body
                  )}
                >
                  {section.body}
                </p>
              ) : null}
              <ul className={cn(resolveShowcaseGridColsClass(section.columns, 4), 'mt-5')}>
                {data.highlights.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      'min-w-0 rounded-2xl border px-4 py-5 text-base font-medium leading-snug tracking-tight',
                      tokens.highlightCard
                    )}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </>
          </AuroraParallaxLayer>
        ) : null}
        {section.id === 'testimonials' ? (
          <AuroraParallaxLayer layer="content">
            <ShowcaseReviewsCarousel
              reviews={data.testimonials}
              variant="aurora"
              className="mt-5"
            />
          </AuroraParallaxLayer>
        ) : null}
        {section.body && section.id !== 'highlights' && section.id !== 'testimonials' ? (
          <AuroraParallaxLayer layer="content">
            <p className={cn('@sm:text-lg mt-5 max-w-2xl text-base leading-relaxed', tokens.body)}>
              {section.body}
            </p>
          </AuroraParallaxLayer>
        ) : null}
      </div>
    </AuroraParallaxSection>
  );
}

export function AuroraSections({ data }: { data: ShowcaseData }) {
  const { tokens } = useShowcaseTheme();
  const hero = data.sections.find((s) => s.id === 'hero');

  return (
    <>
      <ProgressRail data={data} />
      {hero ? <AuroraHero data={data} section={hero} /> : null}

      {data.sections
        .filter((s) => s.id !== 'hero' && shouldRenderShowcaseSection(s, data))
        .map((section) => {
          if (data.pageKind === 'stay-guide' && section.kind !== 'gallery') {
            return (
              <StayGuideTemplatedSection
                key={section.id}
                data={data}
                section={section}
                containerClassName="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4"
              />
            );
          }
          if (section.id === 'gallery') {
            return (
              <AuroraParallaxSection
                key={section.id}
                id={section.id}
                data={data}
                className={showcaseSectionPyClass}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <AuroraParallaxReveal layer="intro">
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName="@sm:text-4xl text-3xl font-semibold tracking-tight"
                      tokens={tokens}
                      showBody={false}
                    />
                  </AuroraParallaxReveal>
                  <AuroraParallaxLayer layer="content" className="mt-5">
                    <ShowcaseGalleryCarousel
                      images={section.images}
                      propertyName={data.propertyName}
                      variant="aurora"
                      chrome="full"
                      imageClassName="rounded-2xl"
                    />
                  </AuroraParallaxLayer>
                </div>
              </AuroraParallaxSection>
            );
          }

          if (section.id === 'amenities') {
            return (
              <AuroraParallaxSection
                key={section.id}
                id={section.id}
                data={data}
                className={showcaseSectionPyClass}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <AuroraParallaxReveal layer="intro">
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName="@sm:text-4xl text-3xl font-semibold tracking-tight"
                      tokens={tokens}
                    />
                  </AuroraParallaxReveal>
                  <ul className={cn(resolveShowcaseGridColsClass(section.columns, 3), 'mt-5')}>
                    {data.amenities.map((item, index) => (
                      <li
                        key={item}
                        className={cn(
                          'group min-h-11 min-w-0 rounded-2xl border px-5 py-4 text-base transition-all duration-300 hover:-translate-y-0.5',
                          tokens.amenityCell
                        )}
                      >
                        <AuroraParallaxReveal layer="content" delay={Math.min(index * 0.04, 0.28)}>
                          {item}
                        </AuroraParallaxReveal>
                      </li>
                    ))}
                  </ul>
                </div>
              </AuroraParallaxSection>
            );
          }

          if (section.id === 'location') {
            return (
              <AuroraParallaxContainer key={section.id} data={data}>
                <ShowcaseLocationSection
                  data={data}
                  section={section}
                  headingClassName="@sm:text-4xl text-3xl font-semibold tracking-tight"
                />
              </AuroraParallaxContainer>
            );
          }

          if (section.id === 'host') {
            return (
              <AuroraParallaxContainer key={section.id} data={data}>
                <AuroraHostSection
                  data={data}
                  section={section}
                  headingClassName="@sm:text-4xl text-3xl font-semibold tracking-tight"
                />
              </AuroraParallaxContainer>
            );
          }

          if (section.id === 'cta') {
            return (
              <AuroraParallaxSection
                key={section.id}
                id={section.id}
                data={data}
                className={showcaseCtaSectionPyClass}
              >
                <AuroraParallaxLayer layer="accent" className="mx-auto max-w-4xl px-4">
                  <div
                    className={cn(
                      '@sm:px-10 rounded-[2rem] px-6 text-center',
                      showcaseCtaInnerPyClass,
                      tokens.ctaSurface
                    )}
                  >
                    <AuroraParallaxReveal layer="intro">
                      <ShowcaseSectionIntro
                        section={section}
                        headingClassName="@sm:text-4xl text-3xl font-semibold tracking-tight"
                        tokens={tokens}
                        align="center"
                      />
                    </AuroraParallaxReveal>
                    <AuroraParallaxReveal layer="content" delay={0.08}>
                      <ShowcaseCtaActions
                        data={data}
                        ctaLabel={section.ctaLabel}
                        ctaTarget={section.ctaTarget}
                        primaryLabel="Book now"
                        className="mt-6"
                      />
                    </AuroraParallaxReveal>
                  </div>
                </AuroraParallaxLayer>
              </AuroraParallaxSection>
            );
          }

          return <GenericSection key={section.id} data={data} section={section} />;
        })}
    </>
  );
}
