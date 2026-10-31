import type { ReactNode } from 'react';

import { Sparkles } from 'lucide-react';

import { ShowcaseGalleryCarousel } from '@/features/guest/marketing/showcase/components/ShowcaseGalleryCarousel';
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcasePreviewMockBanner } from '@/features/guest/marketing/showcase/components/ShowcasePreviewMockBanner';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import { showcaseHeroTopAlignedSectionClass } from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';
import {
  parseShowcaseHighlight,
  resolveShowcaseGridColsClass,
  resolveShowcasePrimaryCtaHref,
  resolveShowcaseSecondaryCtaHref,
  resolveShowcaseSecondaryCtaLabel,
  shouldRenderShowcaseSection,
  showcaseCtaInnerPyClass,
  showcaseCtaSectionPyClass,
  showcaseSectionPyClass,
  showcaseTestimonialsForDisplay,
  showcaseTestimonialsGridClass,
  showcaseTestimonialsGridItemClass,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import { resolveShowcaseMotionReduced } from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import { HavenHostSection } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseHostSections';
import { ShowcaseLocationPanel } from '@/features/guest/marketing/showcase/templates/shared/ShowcaseInfoPanels';
import { StayGuideTemplatedSection } from '@/features/guest/marketing/showcase/templates/shared/StayGuideSections';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

const DISPLAY = 'font-fraunces tracking-[-0.01em]';
const CONTAINER = 'mx-auto max-w-5xl px-5 @md:px-8';

function Stamp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'border-current/40 inline-flex -rotate-3 items-center gap-1.5 rounded-2xl border-2 border-dashed bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur',
        className
      )}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  const { tokens } = useShowcaseTheme();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
        tokens.cardBorder,
        tokens.muted
      )}
    >
      {children}
    </span>
  );
}

function HavenHero({ data, section }: { data: ShowcaseData; section: ShowcaseResolvedSection }) {
  const { tokens } = useShowcaseTheme();
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const image = section.images[0];
  const title = section.heading === 'Your stay' ? data.propertyName : section.heading;
  const stamp = data.host.verifiedBadge
    ? 'Verified host'
    : data.host.isSuperhost
      ? 'Superhost'
      : 'Book direct';

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(
        '@md:px-8 relative scroll-mt-24 overflow-hidden px-5',
        showcaseHeroTopAlignedSectionClass(containedChrome, 'haven')
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-[hsl(var(--showcase-accent,var(--primary)))]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-40 size-[24rem] rounded-full bg-[#e8b98a]/25 blur-3xl"
      />

      <div className="@lg:grid-cols-[1.05fr_1fr] @lg:gap-12 relative mx-auto grid max-w-6xl items-center gap-8">
        <ShowcaseReveal reduced={data.reducedMotion} className="min-w-0">
          <Eyebrow>{data.heroEyebrow}</Eyebrow>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1
              className={cn(DISPLAY, 'text-[clamp(2.25rem,6vw,4rem)] font-medium leading-[1.05]')}
            >
              {title}
            </h1>
            {section.usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
          </div>
          {section.subheading ? (
            <p className={cn('@md:text-lg mt-5 max-w-md text-base leading-relaxed', tokens.body)}>
              {section.subheading}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ShowcaseSectionLink
              to={resolveShowcasePrimaryCtaHref(section.ctaTarget, data)}
              className={cn(
                'inline-flex h-12 min-w-[11rem] items-center justify-center px-8 text-sm font-semibold',
                tokens.primaryBtn
              )}
            >
              {section.ctaLabel || 'Request stay'}
            </ShowcaseSectionLink>
            <ShowcaseSectionLink
              to={resolveShowcaseSecondaryCtaHref(data)}
              className={cn(
                'inline-flex h-12 min-w-[11rem] items-center justify-center border px-8 text-sm font-semibold',
                tokens.secondaryBtn
              )}
            >
              {resolveShowcaseSecondaryCtaLabel(data)}
            </ShowcaseSectionLink>
          </div>
        </ShowcaseReveal>

        <ShowcaseReveal reduced={data.reducedMotion} delay={0.1} className="relative min-w-0">
          <div
            className={cn(
              '@lg:aspect-[4/5] relative aspect-[4/5] overflow-hidden rounded-[2rem]',
              tokens.card
            )}
          >
            {image ? (
              <img
                src={image}
                alt=""
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                className="size-full object-cover"
              />
            ) : (
              <div className="from-primary/20 size-full bg-gradient-to-br to-transparent" />
            )}
          </div>
          <Stamp className="absolute -bottom-4 left-6 text-[#2c2622]">{stamp}</Stamp>
        </ShowcaseReveal>
      </div>
    </section>
  );
}

function Block({ id, children, alt }: { id: string; children: ReactNode; alt?: boolean }) {
  const { tokens } = useShowcaseTheme();
  return (
    <section
      id={id}
      data-page-editor-anchor={id}
      className={cn('scroll-mt-24', showcaseSectionPyClass, alt && tokens.sectionAlt)}
    >
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}

function Heading({
  eyebrow,
  title,
  usesPreviewMock,
}: {
  eyebrow: string;
  title: string;
  usesPreviewMock?: boolean;
}) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <ShowcaseSectionHeading
        heading={title}
        headingClassName={cn(DISPLAY, '@sm:text-4xl mt-4 text-3xl font-medium')}
        usesPreviewMock={usesPreviewMock}
      />
    </>
  );
}

export function HavenSections({ data }: { data: ShowcaseData }) {
  const { tokens } = useShowcaseTheme();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const hero = data.sections.find((s) => s.id === 'hero');
  const rest = data.sections.filter((s) => s.id !== 'hero' && shouldRenderShowcaseSection(s, data));

  return (
    <div className="font-figtree">
      {hero ? <HavenHero data={data} section={hero} /> : null}

      {rest.map((sec, index) => {
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

        if (sec.id === 'location') {
          return (
            <div key={sec.id} className={cn(alt && tokens.sectionAlt)}>
              <ShowcaseLocationPanel
                data={data}
                section={sec}
                className={showcaseSectionPyClass}
                innerClassName={CONTAINER}
                headingClassName={cn(DISPLAY, '@sm:text-4xl mt-4 text-3xl font-medium')}
                eyebrow={<Eyebrow>Around here</Eyebrow>}
                frameClassName="rounded-[2rem] border"
                mapAspectClassName="aspect-[16/10] @md:aspect-[2/1]"
                actionClassName="rounded-full"
              />
            </div>
          );
        }

        if (sec.id === 'host') {
          return (
            <div key={sec.id} className={cn(alt && tokens.sectionAlt)}>
              <HavenHostSection
                data={data}
                section={sec}
                headingClassName={cn(DISPLAY, '@sm:text-4xl mt-4 text-3xl font-medium')}
                eyebrow={<Eyebrow>Say hello</Eyebrow>}
              />
            </div>
          );
        }

        if (sec.id === 'gallery') {
          return (
            <Block key={sec.id} id={sec.id} alt={alt}>
              <ShowcaseReveal reduced={motionReduced}>
                <Heading
                  eyebrow="Look around"
                  title={sec.heading}
                  usesPreviewMock={sec.usesPreviewMock}
                />
              </ShowcaseReveal>
              <div className="mt-7">
                <ShowcaseGalleryCarousel
                  images={sec.images}
                  propertyName={data.propertyName}
                  variant="haven"
                  chrome="full"
                  imageClassName="rounded-3xl"
                />
              </div>
            </Block>
          );
        }

        if (sec.id === 'cta') {
          return (
            <section
              key={sec.id}
              id={sec.id}
              data-page-editor-anchor={sec.id}
              className={cn('@md:px-8 scroll-mt-24 px-5', showcaseCtaSectionPyClass)}
            >
              <ShowcaseReveal reduced={motionReduced} className="mx-auto max-w-4xl">
                <div
                  className={cn(
                    '@md:px-16 relative px-6 text-center',
                    showcaseCtaInnerPyClass,
                    tokens.ctaSurface
                  )}
                >
                  <div className="flex justify-center">
                    <Stamp className="text-[#2c2622]">
                      {sec.subheading || 'Ready when you are'}
                    </Stamp>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                    <h2 className={cn(DISPLAY, '@sm:text-4xl @md:text-5xl text-3xl font-medium')}>
                      {sec.heading}
                    </h2>
                    {sec.usesPreviewMock ? <ShowcasePreviewMockBanner /> : null}
                  </div>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <ShowcaseSectionLink
                      to={resolveShowcasePrimaryCtaHref(sec.ctaTarget, data)}
                      className={cn(
                        'inline-flex h-12 min-w-[11rem] items-center justify-center px-8 text-sm font-semibold',
                        tokens.primaryBtn
                      )}
                    >
                      {sec.ctaLabel || 'Book now'}
                    </ShowcaseSectionLink>
                    <ShowcaseSectionLink
                      to={resolveShowcaseSecondaryCtaHref(data)}
                      className={cn(
                        'inline-flex h-12 min-w-[11rem] items-center justify-center border px-8 text-sm font-semibold',
                        tokens.secondaryBtn
                      )}
                    >
                      {resolveShowcaseSecondaryCtaLabel(data)}
                    </ShowcaseSectionLink>
                  </div>
                </div>
              </ShowcaseReveal>
            </section>
          );
        }

        return (
          <Block key={sec.id} id={sec.id} alt={alt}>
            <ShowcaseReveal reduced={motionReduced}>
              <Heading
                eyebrow={
                  sec.id === 'about'
                    ? 'The place'
                    : sec.id === 'amenities'
                      ? "What's inside"
                      : sec.id === 'highlights'
                        ? 'Good to know'
                        : sec.id === 'testimonials'
                          ? 'Guest notes'
                          : 'More'
                }
                title={sec.heading}
                usesPreviewMock={sec.usesPreviewMock}
              />
            </ShowcaseReveal>

            <div className="mt-6">
              {sec.id === 'about' ? (
                <ShowcaseReveal reduced={motionReduced}>
                  <p
                    className={cn(
                      '@md:text-lg max-w-2xl text-base leading-relaxed',
                      'first-letter:font-fraunces first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-5xl first-letter:font-medium first-letter:leading-[0.8]',
                      tokens.body
                    )}
                  >
                    {sec.body}
                  </p>
                </ShowcaseReveal>
              ) : null}

              {sec.id === 'amenities' ? (
                <>
                  {sec.subheading ? (
                    <p className={cn('mb-6 max-w-xl text-base leading-relaxed', tokens.body)}>
                      {sec.subheading}
                    </p>
                  ) : null}
                  <ul className={cn(resolveShowcaseGridColsClass(sec.columns, 3), 'items-stretch')}>
                    {data.amenities.map((item, i) => (
                      <li key={item} className="h-full">
                        <ShowcaseReveal
                          reduced={motionReduced}
                          delay={Math.min(i * 0.03, 0.24)}
                          className="h-full"
                        >
                          <div
                            className={cn(
                              'flex h-full min-h-[4.25rem] items-center gap-3',
                              tokens.amenityCell
                            )}
                          >
                            <span className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--showcase-accent,var(--primary)))]" />
                            <span className="@sm:text-base min-w-0 text-sm leading-snug">
                              {item}
                            </span>
                          </div>
                        </ShowcaseReveal>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {sec.id === 'highlights' ? (
                <>
                  <ul className={cn(resolveShowcaseGridColsClass(sec.columns, 4), 'items-stretch')}>
                    {data.highlights.map((item) => {
                      const { value, label } = parseShowcaseHighlight(item);
                      return (
                        <li
                          key={item}
                          className={cn(
                            '@sm:px-6 @sm:py-6 flex h-full min-h-[7.25rem] flex-col justify-center px-5 py-5',
                            tokens.highlightCard
                          )}
                        >
                          {value ? (
                            <>
                              <p
                                className={cn(
                                  DISPLAY,
                                  '@sm:text-[1.75rem] text-2xl font-medium leading-none'
                                )}
                              >
                                {value}
                              </p>
                              <p className={cn('mt-2 text-sm leading-snug', tokens.muted)}>
                                {label}
                              </p>
                            </>
                          ) : (
                            <p
                              className={cn(
                                '@sm:text-[1.0625rem] text-base font-medium leading-snug',
                                tokens.body
                              )}
                            >
                              {label}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}

              {sec.id === 'testimonials' ? (
                <>
                  {sec.subheading ? (
                    <p className={cn('mb-6 max-w-xl text-base leading-relaxed', tokens.body)}>
                      {sec.subheading}
                    </p>
                  ) : null}
                  <div className={showcaseTestimonialsGridClass}>
                    {showcaseTestimonialsForDisplay(data.testimonials).map((item) => (
                      <blockquote
                        key={item.id}
                        className={cn(
                          'flex h-full min-h-[10.5rem] flex-col',
                          showcaseTestimonialsGridItemClass,
                          tokens.testimonialCard
                        )}
                      >
                        <p className={cn('flex-1', tokens.testimonialQuote)}>
                          &ldquo;{item.body}&rdquo;
                        </p>
                        <footer
                          className={cn(
                            'mt-4 shrink-0 text-sm font-semibold',
                            tokens.testimonialFooter
                          )}
                        >
                          {item.author}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </>
              ) : null}

              {sec.id !== 'about' &&
              sec.id !== 'amenities' &&
              sec.id !== 'highlights' &&
              sec.id !== 'testimonials' &&
              sec.body ? (
                <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>{sec.body}</p>
              ) : null}
            </div>
          </Block>
        );
      })}
    </div>
  );
}
