import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { motion, useTransform } from 'framer-motion';

import { ShowcaseCanvas } from '@/features/guest/marketing/showcase/components/ShowcaseCanvas';
import { ShowcaseGalleryCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseGalleryCarousel';
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcasePreviewMockBanner } from '@/features/guest/marketing/showcase/components/ShowcasePreviewMockBanner';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import {
  showcaseHeroContentTopClass,
  showcaseHeroSectionClass,
} from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';
import { resolveShowcaseScrollRoot } from '@/features/guest/marketing/showcase/lib/showcaseScroll';
import {
  parseShowcaseHighlight,
  resolveShowcasePrimaryCtaHref,
  resolveShowcaseSecondaryCtaHref,
  resolveShowcaseSecondaryCtaLabel,
  shouldRenderShowcaseSection,
  showcaseChapterSectionPyClass,
  showcaseCtaSectionPyClass,
  showcaseTestimonialsForDisplay,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import {
  resolveShowcaseCanvasPaused,
  resolveShowcaseHeroOverlayClass,
  resolveShowcaseMotionReduced,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import { useShowcaseScrollProgress } from '@/features/guest/marketing/showcase/templates/aurora/useShowcaseScrollProgress';
import { VersoHostSection } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseHostSections';
import { ShowcaseLocationPanel } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseInfoPanels';
import {
  CountUp,
  CrossfadeStage,
  KenBurns,
  Marquee,
  MaskText,
  WordReveal,
} from '@/features/guest/marketing/showcase/templates/shared/showcaseKinetic';
import { StayGuideTemplatedSection } from '@/features/guest/marketing/showcase/templates/shared/StayGuideSections';
import {
  versoAboutStatementClass,
  versoAmenityItemClass,
  versoChapterTitleClass,
  versoCtaTitleClass,
  versoHeroTitleClass,
  versoHighlightValueClass,
  versoMarqueeTitleClass,
  versoTestimonialQuoteClass,
} from '@/features/guest/marketing/showcase/templates/verso/versoTypography';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

const DISPLAY = 'font-jost font-medium tracking-[-0.02em]';
const LABEL = 'font-jost text-[11px] font-semibold uppercase tracking-[0.36em]';
const CONTAINER = 'mx-auto max-w-6xl px-5 @md:px-8';
const EASE = [0.16, 1, 0.3, 1] as const;

/* --------------------------------------------------------------- hero */

function VersoHero({ data, section }: { data: ShowcaseData; section: ShowcaseResolvedSection }) {
  const { tokens } = useShowcaseTheme();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const reduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const canvasOff = resolveShowcaseCanvasPaused(data.config, data.reducedMotion);
  const overlayClass = resolveShowcaseHeroOverlayClass(data.config.palette.overlay);
  const image = section.images[0];
  const title = section.heading === 'Your stay' ? data.propertyName : section.heading;
  const onImage = Boolean(image);

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        'relative flex scroll-mt-24 flex-col justify-end overflow-hidden',
        showcaseHeroSectionClass(containedChrome),
        !image && tokens.page
      )}
    >
      {image ? (
        <div className="absolute inset-0">
          <KenBurns src={image} reduced={reduced} eager className="scale-105" />
        </div>
      ) : null}
      <ShowcaseCanvas variant="grain" paused={canvasOff} className="opacity-40" />
      {image ? <div className={cn('absolute inset-0 bg-gradient-to-t', overlayClass)} /> : null}

      <div
        className={cn(
          '@md:pb-20 relative z-10 w-full pb-14',
          CONTAINER,
          showcaseHeroContentTopClass(containedChrome)
        )}
      >
        <div className="flex items-center gap-4">
          <motion.span
            className={cn('block h-px w-10 origin-left', onImage ? 'bg-white/70' : 'bg-current/40')}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          />
          <motion.p
            className={cn(LABEL, onImage ? 'text-white/80' : tokens.muted)}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {data.heroEyebrow}
          </motion.p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1
            className={cn(
              DISPLAY,
              'w-full min-w-0 max-w-[16ch]',
              versoHeroTitleClass,
              onImage ? 'text-white' : ''
            )}
          >
            <MaskText text={title} reduced={reduced} stagger={0.06} delay={0.15} immediate />
          </h1>
          {section.usesPreviewMock ? (
            <ShowcasePreviewMockBanner variant={onImage ? 'onDark' : 'default'} />
          ) : null}
        </div>

        {section.subheading ? (
          <motion.p
            className={cn(
              'mt-6 max-w-md text-base leading-relaxed',
              onImage ? 'text-white/85' : tokens.body
            )}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            {section.subheading}
          </motion.p>
        ) : null}

        <motion.div
          className="mt-10 flex flex-wrap gap-3"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <SweepLink to={resolveShowcasePrimaryCtaHref(section.ctaTarget, data)} filled={onImage}>
            {section.ctaLabel || 'Request stay'}
          </SweepLink>
          <SweepLink to={resolveShowcaseSecondaryCtaHref(data)} onImage={onImage}>
            {resolveShowcaseSecondaryCtaLabel(data)}
          </SweepLink>
        </motion.div>
      </div>

      {!reduced ? (
        <div className="@md:block absolute bottom-0 left-1/2 z-10 hidden -translate-x-1/2">
          <motion.span
            className={cn('block w-px', onImage ? 'bg-white/60' : 'bg-current/40')}
            initial={{ height: 0 }}
            animate={{ height: [0, 56, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      ) : null}
    </section>
  );
}

function SweepLink({
  to,
  children,
  filled,
  onImage,
  onCta,
}: {
  to: string;
  children: ReactNode;
  filled?: boolean;
  onImage?: boolean;
  onCta?: boolean;
}) {
  const { tokens, mode } = useShowcaseTheme();
  const ctaFilled =
    mode === 'dark'
      ? 'border-[#0b0b0c] bg-[#0b0b0c] text-[#f4f4f2]'
      : 'border-white bg-white text-[#0b0b0c]';
  const ctaGhost =
    mode === 'dark' ? 'border-[#0b0b0c]/40 text-[#0b0b0c]' : 'border-white/55 text-[#f4f4f2]';
  const ctaGhostFill = mode === 'dark' ? 'bg-[#0b0b0c]' : 'bg-white';
  const ctaGhostHoverText =
    mode === 'dark' ? 'group-hover:text-[#f4f4f2]' : 'group-hover:text-[#0b0b0c]';

  return (
    <ShowcaseSectionLink
      to={to}
      className={cn(
        'group relative inline-flex h-14 min-w-[13rem] items-center justify-center overflow-hidden border px-9',
        LABEL,
        filled
          ? onCta
            ? ctaFilled
            : 'border-white bg-white text-[#0b0b0c]'
          : onCta
            ? ctaGhost
            : onImage
              ? 'border-white/60 text-white'
              : cn('border-current', tokens.body)
      )}
    >
      {!filled ? (
        <span
          className={cn(
            'absolute inset-0 origin-left scale-x-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100',
            onCta ? ctaGhostFill : onImage ? 'bg-white' : 'bg-current'
          )}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          'relative z-10 transition-colors duration-300',
          !filled &&
            (onCta
              ? ctaGhostHoverText
              : onImage
                ? 'group-hover:text-[#0b0b0c]'
                : 'group-hover:text-[var(--verso-invert)]')
        )}
      >
        {children}
      </span>
    </ShowcaseSectionLink>
  );
}

/* --------------------------------------------------------------- marquee band */

function VersoMarquee({ data, reduced }: { data: ShowcaseData; reduced: boolean }) {
  const { tokens } = useShowcaseTheme();
  const name = (data.propertyName || 'Your stay').toUpperCase();
  const rowA = [name, data.locationLabel.toUpperCase() || 'THE STAY', 'BOOK DIRECT'];
  const rowB =
    data.amenities.length > 0
      ? data.amenities.slice(0, 8).map((a) => a.toUpperCase())
      : ['DESIGNED FOR ARRIVAL'];

  return (
    <div className={cn('@md:py-8 border-y py-6', tokens.sectionBorder)}>
      <div className={CONTAINER}>
        <Marquee
          items={rowA}
          reduced={reduced}
          className={cn(DISPLAY, versoMarqueeTitleClass)}
          markClassName="text-[hsl(var(--showcase-accent,var(--primary)))]"
        />
        <div className="mt-3">
          <Marquee
            items={rowB}
            reverse
            reduced={reduced}
            className={cn(LABEL, 'text-sm tracking-[0.3em]', tokens.muted)}
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- section shell */

function Plate({
  id,
  index,
  label,
  children,
  className,
  usesPreviewMock,
}: {
  id: string;
  index: number;
  label: string;
  children: ReactNode;
  className?: string;
  usesPreviewMock?: boolean;
}) {
  const { tokens } = useShowcaseTheme();
  return (
    <section
      id={id}
      data-page-editor-anchor={id}
      className={cn(
        'scroll-mt-24 overflow-x-clip border-t',
        showcaseChapterSectionPyClass,
        tokens.sectionBorder,
        className
      )}
    >
      <div className={CONTAINER}>
        <div className={cn('mb-12 flex flex-wrap items-baseline gap-x-5 gap-y-2', tokens.muted)}>
          <span className={cn(DISPLAY, '@md:text-3xl text-2xl font-semibold')}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className={LABEL}>{label}</span>
          {usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
          <motion.span
            className="h-px flex-1 origin-left bg-current opacity-20"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        </div>
        {children}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- pinned gallery */

function VersoPinnedGallery({
  data,
  section,
  index,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  index: number;
}) {
  const { tokens } = useShowcaseTheme();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [maxX, setMaxX] = useState(0);
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 720
  );
  const images = section.images;
  /** Keep scrub springy unless the guest prefers reduced motion (layout still pins). */
  const scrubSmooth = !data.reducedMotion;

  const scrollYProgress = useShowcaseScrollProgress(sectionRef, {
    mode: 'pin',
    embed: data.embed,
    contained: containedChrome,
    enabled: true,
    smooth: scrubSmooth,
    spring: { stiffness: 90, damping: 26, mass: 0.4 },
  });
  const x = useTransform(scrollYProgress, [0, 1], [0, -maxX]);
  const bar = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useLayoutEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      const sectionEl = sectionRef.current;
      const viewport = viewportRef.current;
      if (!el || !sectionEl || !viewport) return;

      const scrollRoot = resolveShowcaseScrollRoot({
        embed: data.embed,
        containedChrome,
        anchor: sectionEl,
      });
      const viewportWidth = viewport.clientWidth;
      const nextH = Math.max(1, scrollRoot?.clientHeight ?? window.innerHeight);
      setViewportH(nextH);
      // Prefer measured slide width so 100cqw / container quirks cannot collapse maxX to 0.
      const firstSlide = el.querySelector<HTMLElement>('[data-verso-gallery-slide]');
      const slideW = firstSlide?.getBoundingClientRect().width ?? viewportWidth;
      const trackSpan = Math.max(el.scrollWidth, slideW * images.length);
      setMaxX(Math.max(0, trackSpan - viewportWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    const t = window.setTimeout(measure, 400);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (viewportRef.current) ro?.observe(viewportRef.current);
    if (trackRef.current) ro?.observe(trackRef.current);
    const scrollRoot = resolveShowcaseScrollRoot({
      embed: data.embed,
      containedChrome,
      anchor: sectionRef.current,
    });
    if (scrollRoot) ro?.observe(scrollRoot);

    return () => {
      window.removeEventListener('resize', measure);
      window.clearTimeout(t);
      ro?.disconnect();
    };
  }, [containedChrome, data.embed, images.length]);

  return (
    <section
      ref={sectionRef}
      id={section.id}
      data-page-editor-anchor={section.id}
      data-verso-pinned-gallery=""
      className={cn('relative scroll-mt-24 border-t', tokens.sectionBorder)}
      style={{ height: `calc(${viewportH}px + ${maxX}px)` }}
    >
      <div
        ref={viewportRef}
        data-verso-gallery-viewport
        className="sticky top-0 flex flex-col justify-center overflow-hidden"
        style={{ height: viewportH }}
      >
        <div className={cn('flex items-baseline gap-5 pb-8', CONTAINER, tokens.muted)}>
          <span className={cn(DISPLAY, '@md:text-3xl text-2xl font-semibold')}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className={LABEL}>{section.heading}</span>
          {section.usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
        </div>
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex w-max max-w-none gap-0 will-change-transform"
        >
          {images.map((src, i) => (
            <figure
              key={`${src}-${i}`}
              data-verso-gallery-slide=""
              className="relative shrink-0 overflow-hidden"
              style={{ width: '100cqw' }}
            >
              <div className="aspect-[3/4] max-h-[min(72vh,560px)] w-full">
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
              </div>
              <figcaption
                className={cn(
                  LABEL,
                  'absolute bottom-4 left-4 bg-black/40 px-2 py-1 text-white backdrop-blur-sm'
                )}
              >
                {String(i + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </figcaption>
            </figure>
          ))}
        </motion.div>
        <div className={cn('mt-8', CONTAINER)}>
          <div className="bg-current/15 h-px w-full">
            <motion.div className="h-px bg-current" style={{ width: bar }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function VersoGallery({
  data,
  section,
  index,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  index: number;
}) {
  const { tokens } = useShowcaseTheme();
  // Signature Verso UX — pin whenever there are multiple photos. Do not gate on
  // Subtle intensity / reduced-motion (those only soften the scrub spring).
  const canPin = section.images.length > 1;

  if (canPin) {
    return <VersoPinnedGallery data={data} section={section} index={index} />;
  }

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn('scroll-mt-24 border-t', showcaseChapterSectionPyClass, tokens.sectionBorder)}
    >
      <div className={CONTAINER}>
        <div className={cn('mb-10 flex items-baseline gap-5', tokens.muted)}>
          <span className={cn(DISPLAY, '@md:text-3xl text-2xl font-semibold')}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className={LABEL}>{section.heading}</span>
          {section.usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
        </div>
      </div>
      <div className="@md:px-4 px-2">
        <ShowcaseGalleryCarousel
          images={section.images}
          propertyName={data.propertyName}
          variant="verso"
          chrome="overlay"
          imageClassName="rounded-none"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- template */

export function VersoSections({ data }: { data: ShowcaseData }) {
  const { tokens, mode } = useShowcaseTheme();
  const reduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const hero = data.sections.find((s) => s.id === 'hero');
  const rest = data.sections.filter((s) => s.id !== 'hero' && shouldRenderShowcaseSection(s, data));

  return (
    <div
      className="font-jost"
      style={{ ['--verso-invert' as string]: mode === 'dark' ? '#0b0b0c' : '#f4f4f2' }}
    >
      {hero ? <VersoHero data={data} section={hero} /> : null}
      <VersoMarquee data={data} reduced={reduced} />

      {rest.map((section, index) => {
        const label = section.heading;

        if (data.pageKind === 'stay-guide' && section.kind !== 'gallery') {
          return (
            <StayGuideTemplatedSection
              key={section.id}
              data={data}
              section={section}
              alt={index % 2 === 1}
              headingClassName={DISPLAY}
              containerClassName={CONTAINER}
            />
          );
        }

        if (section.id === 'gallery') {
          return <VersoGallery key={section.id} data={data} section={section} index={index} />;
        }

        if (section.id === 'location') {
          return (
            <div key={section.id} className={cn('border-t', tokens.sectionBorder)}>
              <ShowcaseLocationPanel
                data={data}
                section={section}
                className={showcaseChapterSectionPyClass}
                innerClassName={CONTAINER}
                headingClassName={cn(DISPLAY, versoChapterTitleClass)}
                eyebrow={
                  <div className={cn('mb-8 flex items-baseline gap-5', tokens.muted)}>
                    <span className={cn(DISPLAY, 'text-2xl font-semibold')}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={LABEL}>{label}</span>
                  </div>
                }
                frameClassName="rounded-none border"
                mapAspectClassName="aspect-[16/10] @md:aspect-[21/9]"
                actionClassName="rounded-none text-[11px] uppercase tracking-[0.24em]"
              />
            </div>
          );
        }

        if (section.id === 'host') {
          return (
            <div key={section.id} className={cn('border-t', tokens.sectionBorder)}>
              <VersoHostSection
                data={data}
                section={section}
                headingClassName={cn(DISPLAY, versoChapterTitleClass)}
                eyebrow={
                  <div className={cn('mb-8 flex items-baseline gap-5', tokens.muted)}>
                    <span className={cn(DISPLAY, 'text-2xl font-semibold')}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={LABEL}>{label}</span>
                  </div>
                }
              />
            </div>
          );
        }

        if (section.id === 'cta') {
          return (
            <section
              key={section.id}
              id={section.id}
              data-page-editor-anchor={section.id}
              className={cn(
                'relative scroll-mt-24 overflow-hidden border-t px-5 text-center',
                showcaseCtaSectionPyClass,
                tokens.sectionBorder,
                tokens.ctaSurface
              )}
            >
              <div className="mx-auto max-w-4xl">
                <p className={cn(LABEL, 'opacity-70')}>
                  {section.subheading || 'Reserve your dates'}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                  <h2 className={cn(DISPLAY, versoCtaTitleClass)}>
                    <MaskText text={section.heading} reduced={reduced} stagger={0.05} />
                  </h2>
                  {section.usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
                </div>
                <div className="mt-12 flex flex-wrap justify-center gap-3">
                  <SweepLink
                    to={resolveShowcasePrimaryCtaHref(section.ctaTarget, data)}
                    filled
                    onCta
                  >
                    {section.ctaLabel || 'Book now'}
                  </SweepLink>
                  <SweepLink to={resolveShowcaseSecondaryCtaHref(data)} onCta>
                    {resolveShowcaseSecondaryCtaLabel(data)}
                  </SweepLink>
                </div>
              </div>
            </section>
          );
        }

        const displayReviews = showcaseTestimonialsForDisplay(data.testimonials);

        return (
          <Plate
            key={section.id}
            id={section.id}
            index={index}
            label={label}
            usesPreviewMock={section.usesPreviewMock}
          >
            {section.id === 'about' ? (
              <>
                <WordReveal
                  text={section.body ?? ''}
                  reduced={reduced}
                  className={cn(DISPLAY, versoAboutStatementClass)}
                />
              </>
            ) : null}

            {section.id === 'amenities' ? (
              <>
                {section.subheading ? (
                  <p className={cn('mb-10 max-w-xl text-base leading-relaxed', tokens.body)}>
                    {section.subheading}
                  </p>
                ) : null}
                <ul className="overflow-x-clip">
                  {data.amenities.map((item, i) => (
                    <motion.li
                      key={item}
                      className={cn(
                        '@md:gap-6 @md:py-7 group flex items-center gap-5 border-b py-6',
                        tokens.sectionBorder
                      )}
                      initial={reduced ? false : { opacity: 0, x: i % 2 === 0 ? -32 : 32 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-8%' }}
                      transition={{ duration: 0.7, ease: EASE, delay: Math.min(i * 0.04, 0.3) }}
                    >
                      <span className={cn(LABEL, '@md:w-10 w-8 shrink-0', tokens.muted)}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          DISPLAY,
                          versoAmenityItemClass,
                          'transition-transform duration-300 group-hover:translate-x-2'
                        )}
                      >
                        {item}
                      </span>
                      <span className="@md:block ml-auto hidden h-px w-0 shrink-0 bg-[hsl(var(--showcase-accent,var(--primary)))] transition-all duration-300 group-hover:w-16" />
                    </motion.li>
                  ))}
                </ul>
              </>
            ) : null}

            {section.id === 'highlights' ? (
              <>
                <div className="@sm:grid-cols-2 @lg:grid-cols-4 grid grid-cols-1 gap-x-6 gap-y-10">
                  {data.highlights.map((item, i) => {
                    const { value, label: text } = parseShowcaseHighlight(item);
                    return (
                      <motion.div
                        key={item}
                        className={i % 2 === 1 ? '@lg:mt-10' : undefined}
                        initial={reduced ? false : { opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-10%' }}
                        transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                      >
                        <CountUp
                          value={value ?? text}
                          reduced={reduced}
                          className={cn(DISPLAY, versoHighlightValueClass)}
                        />
                        {value ? <p className={cn(LABEL, 'mt-4', tokens.muted)}>{text}</p> : null}
                        <span
                          className={cn(
                            'mt-4 block h-px w-full',
                            tokens.sectionBorder,
                            'bg-current opacity-20'
                          )}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {section.id === 'testimonials' ? (
              <>
                {section.subheading ? (
                  <p className={cn('mb-10 max-w-xl text-base leading-relaxed', tokens.body)}>
                    {section.subheading}
                  </p>
                ) : null}
                <CrossfadeStage
                  count={displayReviews.length}
                  reduced={reduced}
                  render={(i) => {
                    const item = displayReviews[i];
                    if (!item) return null;
                    return (
                      <blockquote className="max-w-4xl">
                        <span
                          className={cn(DISPLAY, 'block text-6xl leading-none', tokens.muted)}
                          aria-hidden
                        >
                          &ldquo;
                        </span>
                        <p className={cn(DISPLAY, versoTestimonialQuoteClass)}>{item.body}</p>
                        <footer className={cn(LABEL, 'mt-6', tokens.testimonialFooter)}>
                          {item.author}
                        </footer>
                      </blockquote>
                    );
                  }}
                />
              </>
            ) : null}

            {section.id !== 'about' &&
            section.id !== 'amenities' &&
            section.id !== 'highlights' &&
            section.id !== 'testimonials' &&
            section.body ? (
              <ShowcaseReveal reduced={reduced}>
                <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>
                  {section.body}
                </p>
              </ShowcaseReveal>
            ) : null}
          </Plate>
        );
      })}
    </div>
  );
}
