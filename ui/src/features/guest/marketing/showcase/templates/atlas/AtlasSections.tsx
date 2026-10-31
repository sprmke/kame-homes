import { useEffect, useRef, useState, type ReactNode } from 'react';

import { motion, useTransform } from 'framer-motion';
import { ChevronDown, Compass, Navigation } from 'lucide-react';

import { ShowcaseCanvas } from '@/features/guest/marketing/showcase/components/ShowcaseCanvas';
import { ShowcaseGalleryCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseGalleryCarousel';
import { ShowcaseMapEmbed } from '@/features/guest/marketing/showcase/components/ShowcaseMapEmbed';
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcasePreviewMockBanner } from '@/features/guest/marketing/showcase/components/ShowcasePreviewMockBanner';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import {
  showcaseHeroContentTopClass,
  showcaseHeroSectionClass,
} from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';
import {
  formatShowcaseAddress,
  formatShowcaseAreaLabel,
  formatShowcaseMapsLink,
  formatShowcaseStreetLine,
  shouldShowShowcaseStreetLine,
} from '@/features/guest/marketing/showcase/lib/showcaseLocation';
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
  resolveShowcaseParallaxEnabled,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import { useShowcaseScrollProgress } from '@/features/guest/marketing/showcase/templates/aurora/useShowcaseScrollProgress';
import { AtlasHostSection } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseHostSections';
import {
  CountUp,
  KenBurns,
  Parallax,
  TiltCard,
  WordReveal,
} from '@/features/guest/marketing/showcase/templates/shared/showcaseKinetic';
import { StayGuideTemplatedSection } from '@/features/guest/marketing/showcase/templates/shared/StayGuideSections';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

const DISPLAY = 'font-grotesk font-medium tracking-[-0.03em]';
const MONO = 'font-mono text-[11px] uppercase tracking-[0.24em]';
const CONTAINER = 'mx-auto max-w-6xl px-5 @md:px-8';
const EASE = [0.16, 1, 0.3, 1] as const;

function chapterNo(index: number) {
  return `§ ${String(index + 1).padStart(2, '0')}`;
}

function nowManila() {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '';
  }
}

function TimeHUD({ className }: { className?: string }) {
  const [t, setT] = useState(() => nowManila());
  useEffect(() => {
    const id = window.setInterval(() => setT(nowManila()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!t) return null;
  return (
    <span className={cn('tabular-nums', className)}>
      {t} <span className="opacity-50">GMT+8</span>
    </span>
  );
}

function coordinates(data: ShowcaseData): string | null {
  if (data.latitude == null || data.longitude == null) return null;
  const lat = `${Math.abs(data.latitude).toFixed(4)}° ${data.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(data.longitude).toFixed(4)}° ${data.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}  /  ${lon}`;
}

function AtlasAtAGlance({ area, highlights }: { area: string | null; highlights: string[] }) {
  const { tokens } = useShowcaseTheme();
  if (!area && highlights.length === 0) return null;

  return (
    <div className={cn('@md:p-8 rounded-2xl border p-6', tokens.card)}>
      <p className={cn(MONO, tokens.muted)}>At a glance</p>

      {area ? (
        <div className="mt-6 min-w-0">
          <p className={cn('text-base font-medium leading-snug', tokens.body)}>{area}</p>
          <p className={cn(MONO, 'mt-2', tokens.muted)}>Area</p>
        </div>
      ) : null}

      {highlights.length > 0 ? (
        <div
          className={cn(
            '@sm:grid-cols-2 @lg:grid-cols-4 grid grid-cols-2 gap-x-6 gap-y-8',
            area && cn('mt-8 border-t pt-8', tokens.sectionBorder)
          )}
        >
          {highlights.map((item) => {
            const { value, label } = parseShowcaseHighlight(item);
            const displayValue = value ?? item;
            return (
              <div key={item} className="min-w-0">
                <p
                  className={cn(
                    value
                      ? cn(DISPLAY, '@sm:text-4xl text-3xl leading-none')
                      : cn('text-base font-medium leading-snug', tokens.body)
                  )}
                >
                  {displayValue}
                </p>
                {value ? <p className={cn(MONO, 'mt-2', tokens.muted)}>{label}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- hero */

function AtlasHero({
  data,
  section: hero,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
}) {
  const { tokens } = useShowcaseTheme();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const reduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const canvasOff = resolveShowcaseCanvasPaused(data.config, data.reducedMotion);
  const parallaxOn = resolveShowcaseParallaxEnabled(data.config, data.reducedMotion, data.embed);
  const overlayClass = resolveShowcaseHeroOverlayClass(data.config.palette.overlay);
  const image = hero.images[0];
  const title = hero.heading === 'Your stay' ? data.propertyName : hero.heading;
  const onImage = Boolean(image);
  const coords = coordinates(data);
  const area = formatShowcaseAreaLabel(data);

  return (
    <section
      id={hero.id}
      data-page-editor-anchor={hero.id}
      className={cn(
        'relative flex scroll-mt-24 flex-col justify-end overflow-hidden',
        showcaseHeroSectionClass(containedChrome),
        !image && tokens.page
      )}
    >
      {image ? (
        <Parallax
          amount={80}
          reduced={reduced}
          disabled={!parallaxOn}
          embed={data.embed}
          contained={containedChrome}
          className="absolute inset-0 -top-24 bottom-[-6rem]"
        >
          <KenBurns src={image} reduced={reduced} eager className="scale-110" />
        </Parallax>
      ) : null}
      <ShowcaseCanvas variant="mesh" paused={canvasOff} className="opacity-60" />
      {image ? (
        <>
          <div className={cn('absolute inset-0 bg-gradient-to-t', overlayClass)} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        </>
      ) : null}

      <div
        className={cn(
          '@md:pb-10 relative z-10 w-full pb-8',
          CONTAINER,
          showcaseHeroContentTopClass(containedChrome)
        )}
      >
        <motion.p
          className={cn(MONO, onImage ? 'text-white/70' : tokens.muted)}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Field report — {data.heroEyebrow}
        </motion.p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <motion.h1
            className={cn(
              DISPLAY,
              'max-w-4xl text-[clamp(2.25rem,8vw,5rem)] leading-[1.0]',
              onImage ? 'text-white' : ''
            )}
            initial={reduced ? false : { opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: EASE, delay: 0.15 }}
          >
            {title}
          </motion.h1>
          {hero.usesPreviewMock ? (
            <ShowcasePreviewMockBanner variant={onImage ? 'onDark' : 'default'} />
          ) : null}
        </div>

        {hero.subheading ? (
          <motion.p
            className={cn(
              'mt-4 max-w-lg text-base leading-relaxed',
              onImage ? 'text-white/85' : tokens.body
            )}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            {hero.subheading}
          </motion.p>
        ) : null}

        <motion.div
          className="mt-8 flex flex-wrap gap-3"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <ShowcaseSectionLink
            to={resolveShowcasePrimaryCtaHref(hero.ctaTarget, data)}
            className={cn(
              'inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-lg px-7 text-sm font-medium',
              onImage ? 'bg-white text-[#0e1516] hover:bg-white/90' : tokens.primaryBtn
            )}
          >
            {hero.ctaLabel || 'Request stay'}
          </ShowcaseSectionLink>
          <ShowcaseSectionLink
            to={resolveShowcaseSecondaryCtaHref(data)}
            className={cn(
              'inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-lg border px-7 text-sm font-medium backdrop-blur',
              onImage
                ? 'border-white/40 bg-white/10 text-white hover:bg-white/15'
                : tokens.secondaryBtn
            )}
          >
            {resolveShowcaseSecondaryCtaLabel(data)}
          </ShowcaseSectionLink>
        </motion.div>

        {/* glass HUD */}
        <motion.div
          className={cn(
            'mt-9 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border p-4 backdrop-blur-xl',
            onImage ? 'border-white/15 bg-white/[0.06] text-white' : cn(tokens.card, tokens.body)
          )}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <span className="inline-flex items-center gap-2">
            <Compass className="size-4 opacity-60" aria-hidden />
            <span className={cn(MONO, onImage ? 'text-white/85' : '')}>
              {coords ?? area ?? data.locationLabel}
            </span>
          </span>
          <span className={cn(MONO, onImage ? 'text-white/85' : '')}>
            Local <TimeHUD />
          </span>
        </motion.div>
      </div>

      {!reduced && !containedChrome ? (
        <motion.div
          className={cn(
            'absolute bottom-5 left-1/2 z-10 -translate-x-1/2',
            onImage ? 'text-white/70' : tokens.muted
          )}
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="size-5" aria-hidden />
        </motion.div>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------- chapter shell */

function Chapter({
  id,
  index,
  label,
  children,
  alt,
  usesPreviewMock,
}: {
  id: string;
  index: number;
  label: string;
  children: ReactNode;
  alt?: boolean;
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
        alt && tokens.sectionAlt
      )}
    >
      <div className={cn(CONTAINER, '@lg:grid-cols-[14rem_1fr] @lg:gap-14 grid gap-8')}>
        <div className="@lg:sticky @lg:top-28 @lg:h-fit">
          <p className={cn(MONO, tokens.muted)}>{chapterNo(index)}</p>
          <ShowcaseSectionHeading
            heading={label}
            headingClassName={cn(DISPLAY, '@sm:text-3xl mt-3 text-2xl leading-tight')}
            usesPreviewMock={usesPreviewMock}
          />
          <motion.span
            className="@lg:block mt-5 hidden h-px w-16 origin-left bg-[hsl(var(--showcase-accent,var(--primary)))]"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- gallery */

function AtlasGallery({
  data,
  section,
  index,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  index: number;
}) {
  const { tokens } = useShowcaseTheme();

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        'scroll-mt-24 overflow-x-clip border-t',
        showcaseChapterSectionPyClass,
        tokens.sectionBorder
      )}
    >
      <div className={CONTAINER}>
        <p className={cn(MONO, tokens.muted)}>{chapterNo(index)}</p>
        <ShowcaseSectionHeading
          heading={section.heading}
          headingClassName={cn(DISPLAY, '@sm:text-3xl mt-3 text-2xl')}
          usesPreviewMock={section.usesPreviewMock}
        />
      </div>

      <div className={cn('mt-8', CONTAINER)}>
        <ShowcaseGalleryCarousel
          images={section.images}
          propertyName={data.propertyName}
          variant="atlas"
          chrome="overlay"
          imageClassName={tokens.galleryImageBorder}
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- location (growing map) */

function AtlasLocation({
  data,
  section,
  index,
}: {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  index: number;
}) {
  const { tokens } = useShowcaseTheme();
  const contained = useShowcaseContainedChrome(data.embed);
  const reduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const parallaxOn = resolveShowcaseParallaxEnabled(data.config, data.reducedMotion, data.embed);
  const animateIn = !reduced && parallaxOn;

  const ref = useRef<HTMLElement>(null);
  const scrollYProgress = useShowcaseScrollProgress(ref, {
    mode: 'section',
    embed: data.embed,
    contained,
    enabled: animateIn,
    spring: { stiffness: 100, damping: 28, mass: 0.45 },
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [28, 6]);

  const area = formatShowcaseAreaLabel(data);
  const street = formatShowcaseStreetLine(data);
  const showStreet = shouldShowShowcaseStreetLine(area, street);
  const coords = coordinates(data);
  const mapsLink = formatShowcaseMapsLink(data);
  const mapQuery = formatShowcaseAddress(data);
  const customBody = section.body?.trim() ?? '';
  const showCustom =
    customBody.length > 0 &&
    customBody !== street &&
    customBody !== area &&
    !area.toLowerCase().includes(customBody.toLowerCase());

  return (
    <section
      ref={ref}
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        'scroll-mt-24 overflow-x-clip border-t',
        showcaseChapterSectionPyClass,
        tokens.sectionBorder
      )}
    >
      <div className={CONTAINER}>
        <p className={cn(MONO, tokens.muted)}>{chapterNo(index)}</p>
        <ShowcaseSectionHeading
          heading={section.heading}
          headingClassName={cn(DISPLAY, '@sm:text-3xl mt-3 text-2xl')}
          usesPreviewMock={section.usesPreviewMock}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
          {area ? <span className={cn('text-base font-medium', tokens.body)}>{area}</span> : null}
          {coords ? <span className={cn(MONO, tokens.muted)}>{coords}</span> : null}
        </div>
        {showStreet ? (
          <p className={cn('mt-1 max-w-md text-base leading-relaxed', tokens.muted)}>{street}</p>
        ) : null}
        {showCustom ? (
          <p className={cn('mt-2 max-w-md text-base leading-relaxed', tokens.body)}>{customBody}</p>
        ) : null}
      </div>

      <motion.div
        style={animateIn ? { scale, borderRadius: radius } : { borderRadius: 12 }}
        className={cn(
          'mx-auto mt-8 max-w-[92rem] origin-center overflow-hidden border',
          tokens.cardBorder
        )}
      >
        <div className="@md:aspect-[24/9] relative aspect-[16/10]">
          <ShowcaseMapEmbed
            className="absolute inset-0 size-full"
            latitude={data.latitude}
            longitude={data.longitude}
            placeId={data.placeId}
            address={mapQuery}
          />
        </div>
      </motion.div>

      {mapsLink ? (
        <div className={cn('mt-6', CONTAINER)}>
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium',
              tokens.primaryBtn
            )}
          >
            <Navigation className="size-4" aria-hidden />
            Get directions
          </a>
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------- template */

export function AtlasSections({ data }: { data: ShowcaseData }) {
  const { tokens } = useShowcaseTheme();
  const reduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const hero = data.sections.find((s) => s.id === 'hero');
  const rest = data.sections.filter((s) => s.id !== 'hero' && shouldRenderShowcaseSection(s, data));
  const area = formatShowcaseAreaLabel(data);

  return (
    <div className="font-sans">
      {hero ? <AtlasHero data={data} section={hero} /> : null}

      {rest.map((sec, index) => {
        const label = sec.heading;
        const alt = index % 2 === 1;

        if (data.pageKind === 'stay-guide' && sec.kind !== 'gallery') {
          return (
            <StayGuideTemplatedSection
              key={sec.id}
              data={data}
              section={sec}
              alt={alt}
              headingClassName={DISPLAY}
              containerClassName={CONTAINER}
            />
          );
        }

        if (sec.id === 'gallery') {
          return <AtlasGallery key={sec.id} data={data} section={sec} index={index} />;
        }
        if (sec.id === 'location') {
          return <AtlasLocation key={sec.id} data={data} section={sec} index={index} />;
        }
        if (sec.id === 'host') {
          return (
            <div
              key={sec.id}
              className={cn('border-t', tokens.sectionBorder, alt && tokens.sectionAlt)}
            >
              <AtlasHostSection
                data={data}
                section={sec}
                headingClassName={cn(DISPLAY, '@sm:text-3xl mt-3 text-2xl')}
                eyebrow={<p className={cn(MONO, tokens.muted)}>{chapterNo(index)}</p>}
              />
            </div>
          );
        }

        if (sec.id === 'cta') {
          return (
            <section
              key={sec.id}
              id={sec.id}
              data-page-editor-anchor={sec.id}
              className={cn(
                'relative scroll-mt-24 overflow-hidden border-t px-5',
                showcaseCtaSectionPyClass,
                tokens.sectionBorder
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--showcase-accent,var(--primary)))]/20 blur-[120px]"
              />
              <div
                className={cn(
                  '@md:px-14 relative mx-auto max-w-3xl px-6 py-14 text-center',
                  tokens.ctaSurface
                )}
              >
                <p className={cn(MONO, tokens.muted)}>
                  {sec.subheading || 'Check dates or start your request'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                  <h2 className={cn(DISPLAY, '@sm:text-4xl @md:text-5xl text-3xl')}>
                    {sec.heading}
                  </h2>
                  {sec.usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <ShowcaseSectionLink
                    to={resolveShowcasePrimaryCtaHref(sec.ctaTarget, data)}
                    className={cn(
                      'inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-lg px-7 text-sm font-medium',
                      tokens.primaryBtn
                    )}
                  >
                    {sec.ctaLabel || 'Book now'}
                  </ShowcaseSectionLink>
                  <ShowcaseSectionLink
                    to={resolveShowcaseSecondaryCtaHref(data)}
                    className={cn(
                      'inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-lg border px-7 text-sm font-medium',
                      tokens.secondaryBtn
                    )}
                  >
                    {resolveShowcaseSecondaryCtaLabel(data)}
                  </ShowcaseSectionLink>
                </div>
              </div>
            </section>
          );
        }

        return (
          <Chapter
            key={sec.id}
            id={sec.id}
            index={index}
            label={label}
            alt={alt}
            usesPreviewMock={sec.usesPreviewMock}
          >
            {sec.id === 'about' ? (
              <div className="space-y-8">
                <WordReveal
                  text={sec.body ?? ''}
                  reduced={reduced}
                  className={cn('@md:text-xl max-w-2xl text-lg leading-relaxed', tokens.body)}
                />
                <AtlasAtAGlance area={area} highlights={data.highlights} />
              </div>
            ) : null}

            {sec.id === 'amenities' ? (
              <>
                {sec.subheading ? (
                  <p className={cn('mb-6 max-w-xl text-base leading-relaxed', tokens.body)}>
                    {sec.subheading}
                  </p>
                ) : null}
                <div className="@sm:grid-cols-2 grid gap-3">
                  {data.amenities.map((item, i) => (
                    <motion.div
                      key={item}
                      initial={reduced ? false : { opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-8%' }}
                      transition={{ duration: 0.55, ease: EASE, delay: Math.min(i * 0.04, 0.3) }}
                    >
                      <TiltCard
                        reduced={reduced}
                        max={6}
                        className={cn('flex h-full items-center gap-3', tokens.amenityCell)}
                      >
                        <span className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--showcase-accent,var(--primary)))]" />
                        <span>{item}</span>
                      </TiltCard>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : null}

            {sec.id === 'highlights' ? (
              <>
                <div className="@sm:grid-cols-2 grid gap-4">
                  {data.highlights.map((item, i) => {
                    const { value, label: text } = parseShowcaseHighlight(item);
                    return (
                      <motion.div
                        key={item}
                        className={cn('rounded-2xl border p-6', tokens.highlightCard)}
                        initial={reduced ? false : { opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-10%' }}
                        transition={{ duration: 0.6, ease: EASE, delay: i * 0.06 }}
                      >
                        <CountUp
                          value={value ?? text}
                          reduced={reduced}
                          className={cn(DISPLAY, '@sm:text-5xl block text-4xl leading-none')}
                        />
                        {value ? <p className={cn(MONO, 'mt-3', tokens.muted)}>{text}</p> : null}
                        <motion.span
                          className="mt-4 block h-px w-full origin-left bg-[hsl(var(--showcase-accent,var(--primary)))]"
                          initial={{ scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.06 }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {sec.id === 'testimonials' ? (
              <>
                {sec.subheading ? (
                  <p className={cn('mb-6 max-w-xl text-base leading-relaxed', tokens.body)}>
                    {sec.subheading}
                  </p>
                ) : null}
                <div className="space-y-5">
                  {showcaseTestimonialsForDisplay(data.testimonials).map((item, i) => (
                    <motion.blockquote
                      key={item.id}
                      className={cn('relative', tokens.testimonialBlock)}
                      initial={reduced ? false : { opacity: 0, x: -24 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-10%' }}
                      transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
                    >
                      <span
                        className={cn(DISPLAY, 'absolute right-5 top-3 text-5xl opacity-15')}
                        aria-hidden
                      >
                        &rdquo;
                      </span>
                      <p className={tokens.testimonialQuote}>{item.body}</p>
                      <footer className={cn(MONO, 'mt-4', tokens.testimonialFooter)}>
                        {item.author}
                      </footer>
                    </motion.blockquote>
                  ))}
                </div>
              </>
            ) : null}

            {sec.id !== 'about' &&
            sec.id !== 'amenities' &&
            sec.id !== 'highlights' &&
            sec.id !== 'testimonials' &&
            sec.body ? (
              <ShowcaseReveal reduced={reduced}>
                <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>{sec.body}</p>
              </ShowcaseReveal>
            ) : null}
          </Chapter>
        );
      })}
    </div>
  );
}
