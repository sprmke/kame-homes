import type { CSSProperties, ReactNode } from 'react';

import {
  CalendarCheck,
  CalendarX2,
  Dog,
  FileCheck2,
  MessageCircle,
  ParkingCircle,
} from 'lucide-react';

import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { showcaseSectionPyClass } from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';
import { StayGuideRichContent } from '@/features/guest/stay-guide/components/StayGuideRichContent';

import { cn } from '@/lib/utils';
import { formatStayBoundaryDateShort, formatTimeToAMPM } from '@/utils/format/dates';

/** The section kinds that only Stay Guide produces (Showcase never emits these). */
export function isStayGuideOnlySectionKind(kind: string): boolean {
  return (
    kind === 'passCard' || kind === 'checkInDocuments' || kind === 'chapter' || kind === 'quickNav'
  );
}

type SharedProps = {
  data: ShowcaseData;
  section: ShowcaseResolvedSection;
  alt?: boolean;
  /** Template display-font class for the section heading (e.g. `font-fraunces`). */
  headingClassName?: string;
  containerClassName?: string;
  /** Small pill/eyebrow rendered above the heading, template-styled. */
  eyebrow?: ReactNode;
};

const DEFAULT_CONTAINER = 'mx-auto max-w-4xl px-5 @md:px-8';

const EYEBROW_TEXT: Record<string, string> = {
  passCard: 'Your booking',
  checkInDocuments: 'Before you arrive',
  'getting-in': 'Chapter 01',
  'make-yourself-at-home': 'Chapter 02',
  'before-you-go': 'Chapter 03',
  host: 'Say hello',
};

function DefaultEyebrow({ section }: { section: ShowcaseResolvedSection }) {
  const { tokens } = useShowcaseTheme();
  const text = EYEBROW_TEXT[section.id] ?? EYEBROW_TEXT[section.kind];
  if (!text) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        tokens.cardBorder,
        tokens.muted
      )}
    >
      {text}
    </span>
  );
}

function accentStyle(section: ShowcaseResolvedSection): CSSProperties | undefined {
  if (!section.accentColor) return undefined;
  return {
    ['--primary' as string]: section.accentColor,
    ['--showcase-accent' as string]: section.accentColor,
  };
}

function DocStatus({ status }: { status: 'ready' | 'pending' }) {
  const { tokens } = useShowcaseTheme();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]',
        tokens.cardBorder,
        status === 'ready' ? 'text-[hsl(var(--showcase-accent,var(--primary)))]' : tokens.muted
      )}
    >
      {status === 'ready' ? 'Ready' : 'Pending'}
    </span>
  );
}

function StayGuidePassCard({ data, section, headingClassName, containerClassName }: SharedProps) {
  const { tokens } = useShowcaseTheme();
  const pass = data.stayGuide?.pass;
  if (!pass) return null;

  const rows: { icon: typeof CalendarCheck; label: string; date: string; time: string }[] = [
    {
      icon: CalendarCheck,
      label: 'Check in',
      date: formatStayBoundaryDateShort(pass.checkInDate),
      time: formatTimeToAMPM(pass.checkInTime, true),
    },
    {
      icon: CalendarX2,
      label: 'Check out',
      date: formatStayBoundaryDateShort(pass.checkOutDate),
      time: formatTimeToAMPM(pass.checkOutTime, false),
    },
  ];

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={showcaseSectionPyClass}
    >
      <div className={cn(containerClassName ?? DEFAULT_CONTAINER)}>
        <ShowcaseReveal>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn('@sm:text-3xl text-2xl font-semibold', headingClassName)}
            usesPreviewMock={section.usesPreviewMock}
          />
          {section.subheading ? (
            <p className={cn('mt-2 text-sm', tokens.muted)}>{section.subheading}</p>
          ) : null}
          <div
            className={cn(
              'mt-6 overflow-hidden rounded-3xl border',
              tokens.card,
              tokens.cardBorder
            )}
          >
            <div className={cn('@sm:px-7 border-b px-5 py-4', tokens.cardBorder)}>
              <p className={cn('text-[11px] font-bold uppercase tracking-[0.2em]', tokens.muted)}>
                Guest
              </p>
              <p className="@sm:text-2xl mt-1 text-xl font-semibold">{pass.guestName || 'Guest'}</p>
              <p className={cn('mt-0.5 text-sm', tokens.muted)}>{data.propertyName}</p>
            </div>
            <div className="@sm:grid-cols-2 grid">
              {rows.map(({ icon: Icon, label, date, time }, i) => (
                <div
                  key={label}
                  className={cn(
                    '@sm:px-7 flex flex-col gap-1 px-5 py-4',
                    i === 0 && '@sm:border-b-0 @sm:border-r border-b',
                    tokens.cardBorder
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--showcase-accent,var(--primary)))]">
                    <Icon className="size-3" aria-hidden />
                    {label}
                  </span>
                  <span className="@sm:text-xl text-lg font-semibold">{date || '-'}</span>
                  <span className={cn('text-xs font-medium', tokens.muted)}>{time}</span>
                </div>
              ))}
            </div>
            {pass.needParking || pass.hasPets ? (
              <div
                className={cn(
                  '@sm:px-7 flex flex-wrap gap-2 border-t px-5 py-4',
                  tokens.cardBorder
                )}
              >
                {pass.needParking ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                      tokens.cardBorder
                    )}
                  >
                    <ParkingCircle className="size-3.5" aria-hidden />
                    Parking included
                  </span>
                ) : null}
                {pass.hasPets ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                      tokens.cardBorder
                    )}
                  >
                    <Dog className="size-3.5" aria-hidden />
                    Pet-friendly stay
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </ShowcaseReveal>
      </div>
    </section>
  );
}

function StayGuideCheckInDocs({
  data,
  section,
  alt,
  headingClassName,
  containerClassName,
  eyebrow,
}: SharedProps) {
  const { tokens } = useShowcaseTheme();
  const docs = data.stayGuide?.checkInDocuments ?? [];

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(showcaseSectionPyClass, alt && tokens.sectionAlt)}
    >
      <div className={cn(containerClassName ?? DEFAULT_CONTAINER)}>
        <ShowcaseReveal>
          <div className="mb-3">{eyebrow ?? <DefaultEyebrow section={section} />}</div>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn('@sm:text-3xl text-2xl font-semibold', headingClassName)}
            usesPreviewMock={section.usesPreviewMock}
          />
          {section.subheading ? (
            <p className={cn('mt-2 text-sm', tokens.muted)}>{section.subheading}</p>
          ) : null}
          <ul className="mt-6 space-y-2.5">
            {docs.length === 0 ? (
              <li
                className={cn(
                  'rounded-2xl border px-4 py-3 text-sm',
                  tokens.card,
                  tokens.cardBorder,
                  tokens.muted
                )}
              >
                Approved papers for your stay will appear here.
              </li>
            ) : (
              docs.map((doc) => {
                const inner = (
                  <>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FileCheck2
                        className="size-4 shrink-0 text-[hsl(var(--showcase-accent,var(--primary)))]"
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-sm font-medium">{doc.label}</span>
                      {doc.isPreviewSample ? (
                        <span className={cn('shrink-0 text-[11px]', tokens.muted)}>Sample</span>
                      ) : null}
                    </span>
                    <DocStatus status={doc.status} />
                  </>
                );
                const rowClass = cn(
                  'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3',
                  tokens.card,
                  tokens.cardBorder
                );
                return (
                  <li key={doc.id}>
                    {doc.url && !doc.isPreviewSample ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          rowClass,
                          'transition-colors hover:border-[hsl(var(--showcase-accent,var(--primary)))]'
                        )}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className={rowClass}>{inner}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </ShowcaseReveal>
      </div>
    </section>
  );
}

function StayGuideChapter({
  section,
  alt,
  headingClassName,
  containerClassName,
  eyebrow,
}: SharedProps) {
  const { tokens } = useShowcaseTheme();
  const blocks = section.blocks ?? [];

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(showcaseSectionPyClass, alt && tokens.sectionAlt)}
      style={accentStyle(section)}
    >
      <div className={cn(containerClassName ?? DEFAULT_CONTAINER)}>
        <ShowcaseReveal>
          <div className="mb-3">{eyebrow ?? <DefaultEyebrow section={section} />}</div>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn('@sm:text-3xl text-2xl font-semibold', headingClassName)}
            usesPreviewMock={section.usesPreviewMock}
          />
        </ShowcaseReveal>
        <div className="mt-6 space-y-8">
          {blocks.map((block, i) => {
            const content = (
              <>
                {blocks.length > 1 && block.heading ? (
                  <h3 className="mb-2 text-lg font-semibold">{block.heading}</h3>
                ) : null}
                <StayGuideRichContent html={block.html} />
                {block.imageUrl ? (
                  <img
                    src={block.imageUrl}
                    alt=""
                    loading="lazy"
                    className="mt-4 w-full rounded-2xl object-cover"
                  />
                ) : null}
              </>
            );

            return (
              <ShowcaseReveal key={block.key || i}>
                {blocks.length === 1 ? (
                  content
                ) : (
                  <div
                    className={cn('@md:p-7 rounded-3xl border p-5', tokens.card, tokens.cardBorder)}
                  >
                    {content}
                  </div>
                )}
              </ShowcaseReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StayGuideNeedHelp({
  data,
  section,
  alt,
  headingClassName,
  containerClassName,
  eyebrow,
}: SharedProps) {
  const { tokens } = useShowcaseTheme();
  const phone = data.guestContact.contactPhone.trim();
  const email = data.guestContact.contactEmail.trim();
  const fb = data.guestContact.socialLinks.facebookUrl;

  return (
    <section
      id={section.id}
      data-page-editor-anchor={section.id}
      className={cn(showcaseSectionPyClass, alt && tokens.sectionAlt)}
    >
      <div className={cn(containerClassName ?? DEFAULT_CONTAINER)}>
        <ShowcaseReveal>
          <div className="mb-3">{eyebrow ?? <DefaultEyebrow section={section} />}</div>
          <ShowcaseSectionHeading
            heading={section.heading}
            headingClassName={cn('@sm:text-3xl text-2xl font-semibold', headingClassName)}
          />
          {section.subheading ? (
            <p className={cn('mt-2 text-sm', tokens.muted)}>{section.subheading}</p>
          ) : null}
          <div
            className={cn('@md:p-7 mt-6 rounded-3xl border p-5', tokens.card, tokens.cardBorder)}
          >
            <div className="flex items-center gap-4">
              {data.host.ownerAvatarUrl ? (
                <img
                  src={data.host.ownerAvatarUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className={cn(
                    'flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-bold',
                    tokens.brandFallback
                  )}
                >
                  {(data.host.ownerName || data.propertyName).charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', tokens.muted)}
                >
                  Your host
                </p>
                <p className="truncate text-lg font-semibold">
                  {data.host.ownerName || data.host.organizationName}
                </p>
              </div>
            </div>
            <div className="@sm:flex-row @sm:flex-wrap mt-5 flex flex-col gap-2.5">
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className={cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold',
                    tokens.primaryBtn
                  )}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Message host
                </a>
              ) : null}
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className={cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold',
                    tokens.secondaryBtn
                  )}
                >
                  Email host
                </a>
              ) : null}
              {fb ? (
                <a
                  href={fb}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold',
                    tokens.secondaryBtn
                  )}
                >
                  Facebook
                </a>
              ) : null}
            </div>
          </div>
        </ShowcaseReveal>
      </div>
    </section>
  );
}

/**
 * Renders the Stay-Guide-only section kinds inside whichever template shell is active.
 * Templates call this from their section loop; `hero` / `gallery` / `host` keep their
 * existing per-template renderers (the mapper keeps those ids/kinds).
 */
export function StayGuideTemplatedSection(props: SharedProps) {
  switch (props.section.kind) {
    case 'passCard':
      return <StayGuidePassCard {...props} />;
    case 'checkInDocuments':
      return <StayGuideCheckInDocs {...props} />;
    case 'chapter':
      return <StayGuideChapter {...props} />;
    case 'host':
      return <StayGuideNeedHelp {...props} />;
    case 'quickNav':
      return null;
    default:
      return null;
  }
}
