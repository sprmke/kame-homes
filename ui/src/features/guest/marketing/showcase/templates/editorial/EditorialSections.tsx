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
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcaseReviewsCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseReviewsCarousel';
import { ShowcaseSectionIntro } from '@/features/guest/marketing/showcase/components/ShowcaseSectionIntro';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseStyle } from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import { showcaseHeroTopAlignedSectionClass } from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';
import {
  resolveShowcaseCssColumnsClass,
  resolveShowcaseGridColsClass,
  resolveShowcasePrimaryCtaHref,
  resolveShowcaseSecondaryCtaHref,
  resolveShowcaseSecondaryCtaLabel,
  showcaseCtaSectionPyClass,
  showcaseSectionPyClass,
  shouldRenderShowcaseSection,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import {
  resolveShowcaseCanvasPaused,
  resolveShowcaseMotionReduced,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import {
  showcaseBodyTextClass,
  showcaseEditorialSectionHeadingClass,
  showcaseScaledClampClass,
} from '@/features/guest/marketing/showcase/lib/showcaseTypographyScale';
import { EditorialHostSection } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseHostSections';
import { StayGuideTemplatedSection } from '@/features/guest/marketing/showcase/templates/shared/StayGuideSections';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

function EditorialHero({
  data,
  section,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
}) {
  const { tokens, mode } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const images = section.images.length > 0 ? section.images : [];
  const canvasOff = resolveShowcaseCanvasPaused(data.config, data.reducedMotion);
  const placeholders =
    mode === 'dark'
      ? ['bg-[#2a241c]', 'bg-[#252019]', 'bg-[#1f1a15]']
      : ['bg-[#ddd6c8]', 'bg-[#e7e0d4]', 'bg-[#d6cfc2]'];

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        '@sm:px-6 @lg:px-8 relative scroll-mt-20 overflow-hidden px-4',
        showcaseHeroTopAlignedSectionClass(containedChrome, 'editorial')
      )}
    >
      <ShowcaseCanvas variant="grain" paused={canvasOff} className="opacity-30" />
      <div className="@lg:grid-cols-12 @lg:items-center @lg:gap-10 relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-6">
        <div className="@lg:col-span-5 @lg:py-4 min-w-0">
          <ShowcaseReveal reduced={motionReduced}>
            <p className={cn('text-base tracking-[0.06em]', tokens.muted)}>{data.heroEyebrow}</p>
            <h1
              className={cn(
                displayFontClass,
                showcaseScaledClampClass(1.875, 7, 4.5),
                'mt-3 leading-[0.98] tracking-tight'
              )}
            >
              {section.heading === 'Your stay' ? data.propertyName : section.heading}
            </h1>
            {section.subheading ? (
              <p className={cn('mt-4 max-w-md', showcaseBodyTextClass, tokens.body)}>
                {section.subheading}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <ShowcaseSectionLink
                to={resolveShowcasePrimaryCtaHref(section.ctaTarget, data)}
                className={cn(showcaseCtaBaseClass, primaryButtonClass('editorial', mode))}
              >
                {section.ctaLabel || 'Request stay'}
              </ShowcaseSectionLink>
              <ShowcaseSectionLink
                to={resolveShowcaseSecondaryCtaHref(data)}
                className={cn(showcaseCtaBaseClass, secondaryButtonClass('editorial', mode))}
              >
                {resolveShowcaseSecondaryCtaLabel(data)}
              </ShowcaseSectionLink>
            </div>
          </ShowcaseReveal>
        </div>
        <div className="@sm:grid-cols-2 @lg:col-span-7 @sm:gap-3 @lg:gap-4 grid grid-cols-1 gap-2">
          <motion.div
            className="@sm:col-span-1 @sm:row-span-2 @sm:aspect-auto @sm:min-h-[200px] @lg:min-h-[320px] relative aspect-[16/10] overflow-hidden rounded-sm"
            initial={data.reducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {images[0] ? (
              <img
                src={images[0]}
                alt=""
                className="size-full object-cover"
                loading="eager"
                fetchPriority="high"
                decoding="sync"
              />
            ) : (
              <div className={cn('size-full', placeholders[0])} />
            )}
          </motion.div>
          <motion.div
            className="relative aspect-[4/5] overflow-hidden rounded-sm"
            initial={data.reducedMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {images[1] ? (
              <img
                src={images[1]}
                alt=""
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className={cn('size-full', placeholders[1])} />
            )}
          </motion.div>
          <motion.div
            className="relative aspect-[4/3] overflow-hidden rounded-sm"
            initial={data.reducedMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {images[2] ? (
              <img
                src={images[2]}
                alt=""
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className={cn('size-full', placeholders[2])} />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function EditorialSections({ data }: { data: ShowcaseData }) {
  const { tokens } = useShowcaseTheme();
  const hero = data.sections.find((s) => s.id === 'hero');

  return (
    <div className="font-sans">
      {hero ? <EditorialHero data={data} section={hero} /> : null}

      {data.sections
        .filter((s) => s.id !== 'hero' && shouldRenderShowcaseSection(s, data))
        .map((section) => {
          if (data.pageKind === 'stay-guide' && section.kind !== 'gallery') {
            return (
              <StayGuideTemplatedSection
                key={section.id}
                data={data}
                section={section}
                headingClassName="font-cormorant"
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
                className={cn('scroll-mt-20', showcaseSectionPyClass)}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={showcaseEditorialSectionHeadingClass}
                      tokens={tokens}
                      showBody={false}
                    />
                  </ShowcaseReveal>
                  <div className="mt-5">
                    <ShowcaseGalleryCarousel
                      images={section.images}
                      propertyName={data.propertyName}
                      variant="editorial"
                      chrome="full"
                      imageClassName="rounded-sm"
                    />
                  </div>
                </div>
              </section>
            );
          }

          if (section.id === 'testimonials') {
            return (
              <section
                key={section.id}
                id={section.id}
                data-page-editor-anchor={section.id}
                className={cn('scroll-mt-20', showcaseSectionPyClass)}
              >
                <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={showcaseEditorialSectionHeadingClass}
                      tokens={tokens}
                      showBody={false}
                    />
                  </ShowcaseReveal>
                  <ShowcaseReviewsCarousel
                    reviews={data.testimonials}
                    variant="editorial"
                    className="mt-5"
                  />
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
                headingClassName={showcaseEditorialSectionHeadingClass}
              />
            );
          }

          if (section.id === 'host') {
            return (
              <EditorialHostSection
                key={section.id}
                data={data}
                section={section}
                headingClassName={showcaseEditorialSectionHeadingClass}
              />
            );
          }

          if (section.id === 'cta') {
            return (
              <section
                key={section.id}
                id={section.id}
                data-page-editor-anchor={section.id}
                className={cn('scroll-mt-20', showcaseCtaSectionPyClass)}
              >
                <div
                  className={cn(
                    '@sm:px-10 @sm:py-14 mx-auto max-w-3xl px-4 py-10 text-center',
                    tokens.ctaSurface
                  )}
                >
                  <ShowcaseReveal reduced={data.reducedMotion}>
                    <ShowcaseSectionIntro
                      section={section}
                      headingClassName={showcaseEditorialSectionHeadingClass}
                      tokens={tokens}
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

          return <EditorialGeneric key={section.id} data={data} section={section} />;
        })}
    </div>
  );
}

function EditorialGeneric({
  data,
  section,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
}) {
  const { tokens } = useShowcaseTheme();

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn('scroll-mt-20', showcaseSectionPyClass)}
    >
      <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
        <ShowcaseReveal reduced={data.reducedMotion}>
          <ShowcaseSectionIntro
            section={section}
            headingClassName={showcaseEditorialSectionHeadingClass}
            tokens={tokens}
            showBody={section.id !== 'amenities' && section.id !== 'highlights'}
          />
        </ShowcaseReveal>
        {section.id === 'amenities' ? (
          <ul className={cn(resolveShowcaseCssColumnsClass(section.columns, 3), 'mt-5')}>
            {data.amenities.map((item) => (
              <li
                key={item}
                className={cn('mb-3 break-inside-avoid text-base', tokens.amenityCell)}
              >
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {section.id === 'highlights' ? (
          <ul className={cn(resolveShowcaseGridColsClass(section.columns, 4), 'mt-5')}>
            {data.highlights.map((item) => (
              <li
                key={item}
                className={cn(
                  'min-w-0 px-4 py-5 text-base leading-snug tracking-tight',
                  tokens.highlightCard
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {section.body && (section.id === 'amenities' || section.id === 'highlights') ? (
          <p className={cn('@sm:text-lg mt-5 max-w-2xl text-base leading-relaxed', tokens.body)}>
            {section.body}
          </p>
        ) : null}
      </div>
    </section>
  );
}
