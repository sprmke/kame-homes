import { useCallback, useMemo, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import { useShowcaseMediaPalette } from '@/features/guest/marketing/showcase/hooks/useShowcaseMediaPalette';
import { resolveShowcaseEditorStyleFields } from '@/features/guest/marketing/showcase/lib/showcaseEditorStyleFields';
import { showcasePropertyHasDevelopment } from '@/features/guest/marketing/showcase/lib/showcaseHeroEyebrow';
import { scrollShowcaseToTop } from '@/features/guest/marketing/showcase/lib/showcaseScroll';
import {
  SHOWCASE_SECTION_IDS,
  type ShowcaseSectionId,
  type ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';

import { StyleSection } from '@/features/dashboard/marketing/components/calendar-builder/components/panels/StyleSection';
import { ShowcaseTemplatePicker } from '@/features/dashboard/page-editor/components/property-showcase/ShowcaseTemplatePicker';
import { CopyOverrideField } from '@/features/dashboard/page-editor/components/shared/CopyOverrideField';
import { CtaOverrideField } from '@/features/dashboard/page-editor/components/shared/CtaOverrideField';
import { HeroEyebrowField } from '@/features/dashboard/page-editor/components/shared/HeroEyebrowField';
import { ImageSlotPicker } from '@/features/dashboard/page-editor/components/shared/ImageSlotPicker';
import { SectionReorderList } from '@/features/dashboard/page-editor/components/shared/SectionReorderList';
import {
  ColumnCountControl,
  MotionControl,
  PaletteControl,
  TypographyControl,
} from '@/features/dashboard/page-editor/components/shared/StyleControls';
import {
  PageEditorRevealTarget,
  usePageEditorPreviewScroll,
} from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';
import {
  buildShowcaseSectionCopyOverride,
  buildShowcaseSectionCtaOverride,
  resolveShowcaseSectionEditorBaselines,
  resolveShowcaseSectionEditorDisplayCopy,
  resolveShowcaseSectionEditorDisplayCta,
  showcaseEditorBaselineConfigKey,
} from '@/features/dashboard/page-editor/lib/showcaseSectionEditorCopy';
import { resolveShowcaseSectionEditorFields } from '@/features/dashboard/page-editor/lib/showcaseSectionEditorFields';
import { usePropertyShowcaseEditorStore } from '@/features/dashboard/page-editor/stores/propertyShowcaseEditorStore';

import { cn } from '@/lib/utils';

const SECTION_LABELS: Record<ShowcaseSectionId, string> = {
  hero: 'Hero',
  gallery: 'Gallery',
  about: 'About',
  amenities: 'Amenities',
  highlights: 'Highlights',
  location: 'Location',
  testimonials: 'Testimonials',
  host: 'Host',
  cta: 'Call to action',
};

type Props = {
  property: ResolvedPropertyDetail;
  propertyImages: string[];
  propertyBrandColor?: string | null;
};

export function PropertyShowcaseEditorPanel({
  property,
  propertyImages,
  propertyBrandColor,
}: Props) {
  const config = usePropertyShowcaseEditorStore((s) => s.config);
  const templateKey = usePropertyShowcaseEditorStore((s) => s.templateKey);
  const setTemplateKey = usePropertyShowcaseEditorStore((s) => s.setTemplateKey);
  const setSectionVisible = usePropertyShowcaseEditorStore((s) => s.setSectionVisible);
  const reorderSections = usePropertyShowcaseEditorStore((s) => s.reorderSections);
  const setSectionCopy = usePropertyShowcaseEditorStore((s) => s.setSectionCopy);
  const setSectionColumns = usePropertyShowcaseEditorStore((s) => s.setSectionColumns);
  const setSectionImageSlots = usePropertyShowcaseEditorStore((s) => s.setSectionImageSlots);
  const setSectionCta = usePropertyShowcaseEditorStore((s) => s.setSectionCta);
  const setSectionHeroEyebrow = usePropertyShowcaseEditorStore((s) => s.setSectionHeroEyebrow);
  const setSectionLocationLead = usePropertyShowcaseEditorStore((s) => s.setSectionLocationLead);
  const setPalette = usePropertyShowcaseEditorStore((s) => s.setPalette);
  const setTypography = usePropertyShowcaseEditorStore((s) => s.setTypography);
  const setMotion = usePropertyShowcaseEditorStore((s) => s.setMotion);
  const previewScroll = usePageEditorPreviewScroll();

  const [openSection, setOpenSection] = useState<ShowcaseSectionId | null>('hero');

  const handleTemplateChange = useCallback(
    (next: ShowcaseTemplateKey) => {
      setTemplateKey(next);
      const scrollPreviewToTop = () => {
        previewScroll?.scrollToTop('auto');
        scrollShowcaseToTop('auto');
      };
      window.requestAnimationFrame(scrollPreviewToTop);
      window.setTimeout(scrollPreviewToTop, 120);
    },
    [previewScroll, setTemplateKey]
  );

  const baselineConfigKey = showcaseEditorBaselineConfigKey(config);
  const sectionBaselines = useMemo(
    () => resolveShowcaseSectionEditorBaselines(config, property, templateKey),
    [baselineConfigKey, property, templateKey]
  );

  const orderedSections = [...config.sections].sort((a, b) => a.order - b.order);
  const styleFields = resolveShowcaseEditorStyleFields(templateKey);
  const { palette: mediaPalette } = useShowcaseMediaPalette(
    propertyImages,
    propertyImages.length > 0
  );

  return (
    <div className="min-w-0">
      <StyleSection title="Template" defaultOpen>
        <ShowcaseTemplatePicker
          value={templateKey}
          onChange={handleTemplateChange}
          property={property}
          config={config}
        />
      </StyleSection>

      <StyleSection title="Sections">
        <SectionReorderList
          items={orderedSections.map((section) => ({
            id: section.id,
            label: SECTION_LABELS[section.id],
            visible: section.visible,
            lockedVisible: section.id === 'hero' || section.id === 'cta',
          }))}
          onReorder={(ids) => reorderSections(ids as ShowcaseSectionId[])}
          onVisibilityChange={(id, visible) => setSectionVisible(id as ShowcaseSectionId, visible)}
          previewAnchorForItem={(id) => id}
        />
      </StyleSection>

      <StyleSection title="Style">
        <div className="space-y-4">
          <PaletteControl
            mode={config.palette.mode}
            customPaletteBase={config.palette.customPaletteBase}
            overlay={config.palette.overlay}
            propertyBrandColor={propertyBrandColor}
            mediaPalette={mediaPalette}
            showOverlay={styleFields.heroOverlay}
            onModeChange={(mode) => setPalette({ mode })}
            onCustomPaletteBaseChange={(customPaletteBase) =>
              setPalette({ mode: 'custom', customPaletteBase })
            }
            onOverlayChange={(overlay) => setPalette({ overlay })}
          />
          <TypographyControl
            displayFont={config.typography.displayFont}
            scale={config.typography.scale}
            onDisplayFontChange={(displayFont) => setTypography({ displayFont })}
            onScaleChange={(scale) => setTypography({ scale })}
            hideDisplayFont={!styleFields.displayFont}
          />
          <MotionControl
            intensity={config.motion.intensity}
            parallax={config.motion.parallax}
            canvas={config.motion.canvas}
            showParallax={styleFields.parallax}
            showCanvas={styleFields.canvas}
            onIntensityChange={(intensity) => setMotion({ intensity })}
            onParallaxChange={(parallax) => setMotion({ parallax })}
            onCanvasChange={(canvas) => setMotion({ canvas })}
          />
        </div>
      </StyleSection>

      <StyleSection title="Section details" defaultOpen>
        <div className="space-y-2">
          {SHOWCASE_SECTION_IDS.map((id) => {
            const section = config.sections.find((entry) => entry.id === id);
            if (!section) return null;
            const fields = resolveShowcaseSectionEditorFields(id);
            const baseline = sectionBaselines.get(id);
            const displayCopy = resolveShowcaseSectionEditorDisplayCopy(section.copy, baseline);
            const displayCta = resolveShowcaseSectionEditorDisplayCta(
              section.ctaLabel,
              section.ctaTarget
            );
            const open = openSection === id;
            return (
              <PageEditorRevealTarget key={id} anchor={id}>
                <div className="border-border overflow-hidden rounded-xl border">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm font-medium"
                    onClick={() => setOpenSection(open ? null : id)}
                    aria-expanded={open}
                  >
                    {SECTION_LABELS[id]}
                    <ChevronDown
                      className={cn('size-4 transition-transform', open && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <div className="border-border space-y-4 border-t px-3 py-3">
                      {id === 'hero' ? (
                        <HeroEyebrowField
                          value={section.heroEyebrow}
                          onChange={(next) => setSectionHeroEyebrow(id, next)}
                          developmentAvailable={showcasePropertyHasDevelopment(property)}
                          developmentName={property.residenceName}
                          label="Above heading"
                          idPrefix="showcase-hero-eyebrow"
                        />
                      ) : null}
                      {id === 'location' ? (
                        <HeroEyebrowField
                          value={section.locationLead}
                          onChange={(next) => setSectionLocationLead(id, next)}
                          developmentAvailable={showcasePropertyHasDevelopment(property)}
                          developmentName={property.residenceName}
                          label="Under heading"
                          idPrefix="showcase-location-lead"
                        />
                      ) : null}
                      <CopyOverrideField
                        idPrefix={`showcase-${id}-copy`}
                        value={displayCopy}
                        showHeading={fields.heading}
                        showSubheading={fields.subheading}
                        showBody={fields.body}
                        onChange={(copy) =>
                          setSectionCopy(id, buildShowcaseSectionCopyOverride(baseline, copy))
                        }
                      />
                      {fields.columns ? (
                        <ColumnCountControl
                          value={section.columns ?? 3}
                          onChange={(columns) => setSectionColumns(id, columns)}
                        />
                      ) : null}
                      {fields.imageSlots ? (
                        <ImageSlotPicker
                          images={propertyImages}
                          selected={
                            id === 'hero'
                              ? (section.imageSlots ?? []).slice(0, 1)
                              : (section.imageSlots ?? [])
                          }
                          onChange={(slots) =>
                            setSectionImageSlots(id, id === 'hero' ? slots.slice(0, 1) : slots)
                          }
                          scope={id === 'gallery' ? 'gallery' : 'hero'}
                          selectionMode={id === 'hero' ? 'single' : 'multi'}
                        />
                      ) : null}
                      {fields.cta ? (
                        <CtaOverrideField
                          idPrefix={`showcase-${id}-cta`}
                          ctaLabel={displayCta.ctaLabel}
                          ctaTarget={displayCta.ctaTarget}
                          onChange={(ctaLabel, ctaTarget) => {
                            const override = buildShowcaseSectionCtaOverride(ctaLabel, ctaTarget);
                            setSectionCta(id, override.ctaLabel, override.ctaTarget);
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </PageEditorRevealTarget>
            );
          })}
        </div>
      </StyleSection>
    </div>
  );
}
