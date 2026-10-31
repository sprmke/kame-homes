import { ShowcaseSectionHeading } from '@/features/guest/marketing/showcase/components/ShowcaseSectionHeading';
import type { ShowcaseThemeTokens } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import type { ShowcaseResolvedSection } from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

type Props = {
  section: ShowcaseResolvedSection;
  headingClassName: string;
  tokens: ShowcaseThemeTokens;
  /** When false, body copy is omitted (e.g. location uses address separately). */
  showBody?: boolean;
  bodyClassName?: string;
  align?: 'start' | 'center';
  badgeVariant?: 'default' | 'onDark';
};

export function ShowcaseSectionIntro({
  section,
  headingClassName,
  tokens,
  showBody = true,
  bodyClassName,
  align = 'start',
  badgeVariant = 'default',
}: Props) {
  const alignClass = align === 'center' ? 'mx-auto text-center' : '';
  return (
    <>
      <ShowcaseSectionHeading
        heading={section.heading}
        headingClassName={cn(headingClassName, alignClass)}
        usesPreviewMock={section.usesPreviewMock}
        align={align}
        badgeVariant={badgeVariant}
        className={alignClass}
      />
      {section.subheading ? (
        <p
          className={cn(
            '@sm:text-lg mt-3 max-w-2xl text-base leading-relaxed',
            tokens.subheading,
            alignClass,
            align === 'center' && 'max-w-xl'
          )}
        >
          {section.subheading}
        </p>
      ) : null}
      {showBody && section.body ? (
        <p
          className={cn(
            '@sm:text-lg mt-5 max-w-2xl text-base leading-relaxed',
            tokens.body,
            bodyClassName,
            alignClass
          )}
        >
          {section.body}
        </p>
      ) : null}
    </>
  );
}
