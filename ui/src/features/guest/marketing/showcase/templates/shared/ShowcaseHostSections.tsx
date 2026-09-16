import type { ReactNode } from 'react';

import { ArrowUpRight, Mail, MessageCircle, Phone } from 'lucide-react';

import { HostPublicSocialLinks } from '@/features/guest/marketing/hosts/components/HostPublicSocialLinks';
import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseStyle } from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { resolveShowcaseHostContent } from '@/features/guest/marketing/showcase/lib/showcaseHostContent';
import {
  showcaseChapterSectionPyClass,
  showcaseSectionPyClass,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import { resolveShowcaseMotionReduced } from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import { monolithDisplayFontClass } from '@/features/guest/marketing/showcase/templates/monolith/monolithTypography';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

type HostSectionProps = {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  headingClassName?: string;
  className?: string;
  eyebrow?: ReactNode;
};

function HostAvatar({
  src,
  name,
  className,
  fallbackClassName,
}: {
  src: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('object-cover', className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold',
        className,
        fallbackClassName
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function HostBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('text-primary inline-flex text-xs font-semibold tracking-wide', className)}>
      {label}
    </span>
  );
}

type HostActionsProps = {
  phone: string;
  email: string;
  hostPublicPath: string | null;
  contactPath: string;
  primaryClass: string;
  secondaryClass: string;
  layout?: 'pills' | 'row' | 'stack';
  primaryLabel?: string;
  contactLabel?: string;
};

function HostActions({
  phone,
  email,
  hostPublicPath,
  contactPath,
  primaryClass,
  secondaryClass,
  layout = 'pills',
  primaryLabel = 'View host',
  contactLabel = 'Contact',
}: HostActionsProps) {
  const chip =
    layout === 'pills'
      ? cn('inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium')
      : layout === 'row'
        ? cn(
            'inline-flex min-h-11 items-center gap-2 border-b border-transparent text-sm font-medium transition-colors hover:border-current'
          )
        : cn('inline-flex min-h-11 w-full items-center gap-2 border px-4 text-sm font-medium');

  return (
    <div className={cn('flex flex-wrap gap-3', layout === 'stack' && 'flex-col')}>
      {phone ? (
        <a href={`tel:${phone.replace(/\s/g, '')}`} className={cn(chip, secondaryClass)}>
          <Phone className="size-4 shrink-0" aria-hidden />
          {phone}
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={cn(chip, secondaryClass, 'break-all')}>
          <Mail className="size-4 shrink-0" aria-hidden />
          {email}
        </a>
      ) : null}
      {hostPublicPath ? (
        <ShowcaseSectionLink to={hostPublicPath} className={cn(chip, primaryClass)}>
          {primaryLabel}
          {layout === 'row' ? <ArrowUpRight className="size-4" aria-hidden /> : null}
        </ShowcaseSectionLink>
      ) : null}
      <ShowcaseSectionLink to={contactPath} className={cn(chip, secondaryClass)}>
        {layout === 'pills' ? <MessageCircle className="size-4 shrink-0" aria-hidden /> : null}
        {contactLabel}
      </ShowcaseSectionLink>
    </div>
  );
}

function HostSectionShell({
  section,
  className,
  children,
}: {
  section: ShowcaseResolvedSection;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn('scroll-mt-20 overflow-x-clip', className)}
    >
      {children}
    </section>
  );
}

/** Aurora — glass card, glowing avatar ring, soft depth. */
export function AuroraHostSection({
  data,
  section,
  headingClassName,
  className,
}: HostSectionProps) {
  const { tokens } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const host = resolveShowcaseHostContent(data, section);

  return (
    <HostSectionShell section={section} className={cn(showcaseSectionPyClass, className)}>
      <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
        <ShowcaseReveal reduced={motionReduced}>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn(
              displayFontClass,
              headingClassName ?? '@sm:text-4xl text-3xl font-semibold tracking-tight'
            )}
            usesPreviewMock={host.showPreviewBanner}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.06} className="mt-8">
          <div
            className={cn(
              '@sm:p-10 rounded-[2rem] border p-6 shadow-[0_24px_60px_-40px_hsl(var(--primary)/0.45)] backdrop-blur-sm',
              tokens.card,
              tokens.cardBorder
            )}
          >
            <div className="@lg:flex-row @lg:items-center flex flex-col gap-8">
              <div className="@lg:mx-0 relative mx-auto shrink-0">
                <div
                  className="bg-primary/25 absolute -inset-3 rounded-full blur-2xl"
                  aria-hidden
                />
                <HostAvatar
                  src={host.avatar}
                  name={host.displayName}
                  className="@sm:size-32 relative size-28 rounded-full ring-2 ring-[hsl(var(--primary)/0.35)]"
                  fallbackClassName={tokens.brandFallback}
                />
              </div>

              <div className="@lg:text-left min-w-0 flex-1 text-center">
                <p className={cn('text-xs font-semibold uppercase tracking-[0.2em]', tokens.muted)}>
                  {host.host.organizationName}
                </p>
                <p
                  className={cn(
                    '@sm:text-3xl mt-2 text-2xl font-semibold tracking-tight',
                    tokens.body
                  )}
                >
                  {host.displayName}
                </p>
                {host.badge ? <HostBadge label={host.badge} className="mt-2" /> : null}
                {host.blurb ? (
                  <p
                    className={cn(
                      '@lg:mx-0 mx-auto mt-4 max-w-xl text-base leading-relaxed',
                      tokens.body
                    )}
                  >
                    {host.blurb}
                  </p>
                ) : null}
                <div className="@lg:justify-start mt-6 flex justify-center">
                  <HostActions
                    {...host}
                    primaryClass={cn('rounded-full px-5', tokens.primaryBtn)}
                    secondaryClass={cn('rounded-full', tokens.secondaryBtn)}
                  />
                </div>
                <HostPublicSocialLinks
                  links={host.guestContact.socialLinks}
                  className="@lg:justify-start mt-5 justify-center"
                />
              </div>
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </HostSectionShell>
  );
}

/** Monolith — editorial plate, sharp grid, serif name. */
export function MonolithHostSection({
  data,
  section,
  headingClassName,
  className,
}: HostSectionProps) {
  const { tokens } = useShowcaseTheme();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const host = resolveShowcaseHostContent(data, section);

  return (
    <HostSectionShell
      section={section}
      className={cn(showcaseSectionPyClass, 'border-t-2', tokens.sectionBorder, className)}
    >
      <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
        <ShowcaseReveal reduced={motionReduced}>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={
              headingClassName ??
              cn(monolithDisplayFontClass, '@sm:text-5xl text-4xl tracking-tight')
            }
            usesPreviewMock={host.showPreviewBanner}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.06} className="mt-10">
          <div className="@lg:grid-cols-[10rem_1fr] grid grid-cols-1 gap-8 border-t pt-10">
            <HostAvatar
              src={host.avatar}
              name={host.displayName}
              className="@lg:size-40 size-36 rounded-none object-cover"
              fallbackClassName={cn('rounded-none text-4xl', tokens.brandFallback)}
            />
            <div className="min-w-0 space-y-5">
              <div>
                <p
                  className={cn('font-mono text-[11px] uppercase tracking-[0.28em]', tokens.muted)}
                >
                  {host.host.organizationName}
                </p>
                <p
                  className={cn(
                    '@sm:text-5xl mt-3 font-serif text-4xl leading-none tracking-tight',
                    tokens.body
                  )}
                >
                  {host.displayName}
                </p>
                {host.badge ? (
                  <HostBadge
                    label={host.badge}
                    className="mt-3 block font-mono text-[10px] uppercase tracking-[0.24em]"
                  />
                ) : null}
              </div>
              {host.blurb ? (
                <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>
                  {host.blurb}
                </p>
              ) : null}
              <HostActions
                {...host}
                layout="row"
                primaryClass="text-foreground border-foreground"
                secondaryClass={tokens.muted}
                contactLabel="Message"
              />
              <HostPublicSocialLinks links={host.guestContact.socialLinks} />
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </HostSectionShell>
  );
}

/** Editorial — warm paper card, overlapping portrait. */
export function EditorialHostSection({
  data,
  section,
  headingClassName,
  className,
}: HostSectionProps) {
  const { tokens, mode } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const host = resolveShowcaseHostContent(data, section);
  const paper =
    mode === 'dark' ? 'bg-[#2a241c]/80 border-[#3d352c]' : 'bg-[#f4efe6] border-[#ddd6c8]';
  const portraitRing = mode === 'dark' ? 'ring-[#2a241c]' : 'ring-[#f4efe6]';

  return (
    <HostSectionShell section={section} className={cn(showcaseSectionPyClass, className)}>
      <div className="@sm:px-6 @lg:px-8 mx-auto max-w-6xl px-4">
        <ShowcaseReveal reduced={motionReduced}>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn(
              displayFontClass,
              headingClassName ?? 'font-cormorant @sm:text-5xl text-3xl tracking-tight'
            )}
            usesPreviewMock={host.showPreviewBanner}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.08} className="mt-10">
          <div className={cn('@sm:px-10 @sm:py-10 rounded-sm border px-6 py-8', paper)}>
            <div className="@lg:flex @lg:items-start @lg:gap-10 flex flex-col gap-6">
              <HostAvatar
                src={host.avatar}
                name={host.displayName}
                className={cn('@sm:size-28 size-24 shrink-0 rounded-full ring-4', portraitRing)}
                fallbackClassName={tokens.brandFallback}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('font-cormorant text-lg italic', tokens.muted)}>
                  {host.host.organizationName}
                </p>
                <p className="font-cormorant @sm:text-4xl mt-1 text-3xl leading-tight">
                  {host.displayName}
                </p>
                {host.badge ? <HostBadge label={host.badge} className="mt-2 block" /> : null}
                {host.blurb ? (
                  <p className={cn('mt-4 max-w-xl text-base leading-relaxed', tokens.body)}>
                    {host.blurb}
                  </p>
                ) : null}
                <HostActions
                  {...host}
                  layout="row"
                  primaryClass="text-foreground"
                  secondaryClass={tokens.muted}
                  primaryLabel="Host profile"
                  contactLabel="Send a note"
                />
                <HostPublicSocialLinks links={host.guestContact.socialLinks} className="mt-5" />
              </div>
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </HostSectionShell>
  );
}

/** Verso — numbered plate, uppercase Swiss grid. */
export function VersoHostSection({
  data,
  section,
  headingClassName,
  className,
  eyebrow,
}: HostSectionProps) {
  const { tokens } = useShowcaseTheme();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const host = resolveShowcaseHostContent(data, section);

  return (
    <HostSectionShell section={section} className={cn(showcaseChapterSectionPyClass, className)}>
      <div className="@md:px-8 mx-auto max-w-6xl px-5">
        <ShowcaseReveal reduced={motionReduced}>
          {eyebrow}
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={headingClassName ?? '@sm:text-4xl text-3xl font-semibold uppercase'}
            usesPreviewMock={host.showPreviewBanner}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.06} className="mt-10">
          <div className="@lg:grid-cols-[8rem_1fr] grid grid-cols-1 gap-8 border-t pt-10">
            <HostAvatar
              src={host.avatar}
              name={host.displayName}
              className="size-32 rounded-none object-cover"
              fallbackClassName={cn('rounded-none text-3xl', tokens.brandFallback)}
            />
            <div className="min-w-0 space-y-4">
              <div>
                <p className={cn('text-[11px] uppercase tracking-[0.24em]', tokens.muted)}>
                  {host.host.organizationName}
                </p>
                <p className="@sm:text-3xl mt-2 text-2xl font-semibold uppercase tracking-tight">
                  {host.displayName}
                </p>
                {host.badge ? (
                  <HostBadge
                    label={host.badge.toUpperCase()}
                    className="mt-2 block text-[10px] tracking-[0.22em]"
                  />
                ) : null}
              </div>
              {host.blurb ? (
                <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>
                  {host.blurb}
                </p>
              ) : null}
              <HostActions
                {...host}
                primaryClass={cn(
                  'rounded-none px-5 text-[11px] uppercase tracking-[0.2em]',
                  tokens.primaryBtn
                )}
                secondaryClass={cn(
                  'rounded-none text-[11px] uppercase tracking-[0.2em]',
                  tokens.secondaryBtn
                )}
                contactLabel="Message host"
              />
              <HostPublicSocialLinks links={host.guestContact.socialLinks} />
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </HostSectionShell>
  );
}

/** Atlas — chapter card, mono labels, soft glow. */
export function AtlasHostSection({
  data,
  section,
  headingClassName,
  className,
  eyebrow,
}: HostSectionProps) {
  const { tokens } = useShowcaseTheme();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const host = resolveShowcaseHostContent(data, section);

  return (
    <HostSectionShell section={section} className={cn(showcaseSectionPyClass, className)}>
      <div className="@md:px-8 mx-auto max-w-6xl px-5">
        <ShowcaseReveal reduced={motionReduced}>
          {eyebrow}
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={headingClassName ?? '@sm:text-3xl mt-3 text-2xl'}
            usesPreviewMock={host.showPreviewBanner}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.08} className="mt-8">
          <div
            className={cn(
              '@sm:p-8 relative overflow-hidden rounded-2xl border p-6',
              tokens.card,
              tokens.cardBorder
            )}
          >
            <div
              className="pointer-events-none absolute -right-16 top-0 size-48 rounded-full bg-[hsl(var(--showcase-accent,var(--primary)))]/15 blur-3xl"
              aria-hidden
            />
            <div className="@md:grid-cols-[6.5rem_1fr] relative grid grid-cols-1 gap-6">
              <HostAvatar
                src={host.avatar}
                name={host.displayName}
                className="@md:size-28 size-24 rounded-xl object-cover"
                fallbackClassName={cn('rounded-xl text-2xl', tokens.brandFallback)}
              />
              <div className="min-w-0 space-y-4">
                <div>
                  <p className={cn('font-mono text-xs uppercase tracking-widest', tokens.muted)}>
                    {host.host.organizationName}
                  </p>
                  <p className="@sm:text-2xl mt-2 text-xl font-semibold">{host.displayName}</p>
                  {host.badge ? <HostBadge label={host.badge} className="mt-1 block" /> : null}
                </div>
                {host.blurb ? (
                  <p className={cn('max-w-2xl text-base leading-relaxed', tokens.body)}>
                    {host.blurb}
                  </p>
                ) : null}
                <HostActions
                  {...host}
                  primaryClass={cn('rounded-lg px-5 backdrop-blur', tokens.primaryBtn)}
                  secondaryClass={cn('rounded-lg backdrop-blur', tokens.secondaryBtn)}
                />
                <HostPublicSocialLinks links={host.guestContact.socialLinks} />
              </div>
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </HostSectionShell>
  );
}

/** Haven — warm stamp, circular portrait, rounded shell. */
export function HavenHostSection({
  data,
  section,
  headingClassName,
  className,
  eyebrow,
}: HostSectionProps) {
  const { tokens } = useShowcaseTheme();
  const { displayFontClass } = useShowcaseStyle();
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const host = resolveShowcaseHostContent(data, section);

  return (
    <HostSectionShell section={section} className={cn(showcaseSectionPyClass, className)}>
      <div className="@md:px-8 mx-auto max-w-6xl px-5">
        <ShowcaseReveal reduced={motionReduced}>
          {eyebrow}
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn(
              displayFontClass,
              headingClassName ?? '@sm:text-4xl mt-4 text-3xl font-medium'
            )}
            usesPreviewMock={host.showPreviewBanner}
          />
        </ShowcaseReveal>

        <ShowcaseReveal reduced={motionReduced} delay={0.06} className="mt-8">
          <div
            className={cn(
              '@sm:px-10 @sm:py-10 rounded-[2rem] border px-6 py-8',
              tokens.card,
              tokens.cardBorder
            )}
          >
            <div className="@md:flex-row @md:items-start flex flex-col items-center gap-8">
              <div className="relative shrink-0">
                <HostAvatar
                  src={host.avatar}
                  name={host.displayName}
                  className="@sm:size-32 size-28 rounded-full object-cover ring-4 ring-[#ebe4da]"
                  fallbackClassName={cn('rounded-full text-3xl', tokens.brandFallback)}
                />
                {host.badge ? (
                  <span className="bg-primary text-primary-foreground absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
                    {host.badge}
                  </span>
                ) : null}
              </div>
              <div className="@md:text-left min-w-0 flex-1 text-center">
                <p className={cn('text-sm font-medium', tokens.muted)}>
                  {host.host.organizationName}
                </p>
                <p className={cn('@sm:text-3xl mt-1 text-2xl font-medium', tokens.body)}>
                  {host.displayName}
                </p>
                {host.blurb ? (
                  <p
                    className={cn(
                      '@md:mx-0 mx-auto mt-4 max-w-xl text-base leading-relaxed',
                      tokens.body
                    )}
                  >
                    {host.blurb}
                  </p>
                ) : null}
                <HostActions
                  {...host}
                  primaryClass={cn('rounded-full px-6 font-semibold', tokens.primaryBtn)}
                  secondaryClass={cn('rounded-full', tokens.secondaryBtn)}
                  contactLabel="Message host"
                />
                <HostPublicSocialLinks
                  links={host.guestContact.socialLinks}
                  className="@md:justify-start mt-5 justify-center"
                />
              </div>
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </HostSectionShell>
  );
}
