import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import { mapShowcaseData } from '@/features/guest/marketing/showcase/lib/mapShowcaseData';
import {
  CTA_TARGET_CUSTOM_DRAFT,
  CTA_TARGET_FORM,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import type {
  PropertyShowcaseConfig,
  PropertyShowcaseSectionConfig,
  ShowcaseSectionId,
} from '@/features/guest/marketing/showcase/types/showcase';

export type ShowcaseSectionCopyValue = {
  heading?: string;
  subheading?: string;
  body?: string;
};

function stripSectionOverrides(
  section: PropertyShowcaseSectionConfig
): PropertyShowcaseSectionConfig {
  return { ...section, copy: undefined, ctaLabel: undefined, ctaTarget: undefined };
}

function resolveHeroHeadingForEditor(heading: string, propertyName: string): string {
  return heading === 'Your stay' ? propertyName : heading;
}

export function resolveShowcaseSectionEditorBaselines(
  config: PropertyShowcaseConfig,
  property: ResolvedPropertyDetail,
  templateKey: string
): Map<ShowcaseSectionId, ShowcaseSectionCopyValue> {
  const data = mapShowcaseData({
    property,
    config: {
      ...config,
      sections: config.sections.map(stripSectionOverrides),
    },
    templateKey,
    previewPlaceholders: true,
  });

  return new Map(
    data.sections.map((section) => [
      section.id as ShowcaseSectionId,
      {
        heading: resolveHeroHeadingForEditor(section.heading, data.propertyName),
        subheading: section.subheading,
        body: section.body,
      },
    ])
  );
}

export function resolveShowcaseSectionEditorDisplayCopy(
  storedCopy: ShowcaseSectionCopyValue | undefined,
  baseline: ShowcaseSectionCopyValue | undefined
): ShowcaseSectionCopyValue {
  return {
    heading: storedCopy?.heading ?? baseline?.heading ?? '',
    subheading: storedCopy?.subheading ?? baseline?.subheading ?? '',
    body: storedCopy?.body ?? baseline?.body ?? '',
  };
}

export function buildShowcaseSectionCopyOverride(
  baseline: ShowcaseSectionCopyValue | undefined,
  next: ShowcaseSectionCopyValue
): ShowcaseSectionCopyValue {
  const result: ShowcaseSectionCopyValue = {};
  const keys = ['heading', 'subheading', 'body'] as const;

  for (const key of keys) {
    const nextValue = next[key]?.trim() ?? '';
    const baseValue = baseline?.[key]?.trim() ?? '';
    if (nextValue !== baseValue && nextValue) {
      result[key] = nextValue;
    }
  }

  return result;
}

export const SHOWCASE_SECTION_CTA_BASELINE = {
  ctaLabel: 'Request stay',
  ctaTarget: CTA_TARGET_FORM,
} as const;

export function resolveShowcaseSectionEditorDisplayCta(
  ctaLabel: string | undefined,
  ctaTarget: string | undefined
): { ctaLabel: string; ctaTarget: string } {
  return {
    ctaLabel: ctaLabel ?? SHOWCASE_SECTION_CTA_BASELINE.ctaLabel,
    ctaTarget: ctaTarget ?? SHOWCASE_SECTION_CTA_BASELINE.ctaTarget,
  };
}

export function buildShowcaseSectionCtaOverride(
  ctaLabel: string | undefined,
  ctaTarget: string | undefined
): { ctaLabel?: string; ctaTarget?: string } {
  const label = (ctaLabel ?? '').trim() || SHOWCASE_SECTION_CTA_BASELINE.ctaLabel;
  const target = (ctaTarget ?? '').trim() || SHOWCASE_SECTION_CTA_BASELINE.ctaTarget;

  if (target === CTA_TARGET_CUSTOM_DRAFT) {
    return {
      ctaLabel: label !== SHOWCASE_SECTION_CTA_BASELINE.ctaLabel ? label : undefined,
      ctaTarget: CTA_TARGET_CUSTOM_DRAFT,
    };
  }

  return {
    ctaLabel: label !== SHOWCASE_SECTION_CTA_BASELINE.ctaLabel ? label : undefined,
    ctaTarget: target !== SHOWCASE_SECTION_CTA_BASELINE.ctaTarget ? target : undefined,
  };
}

export function showcaseEditorBaselineConfigKey(config: PropertyShowcaseConfig): string {
  return JSON.stringify({
    ...config,
    sections: config.sections.map(({ copy, ctaLabel, ctaTarget, ...rest }) => rest),
  });
}
