import { useCallback, useMemo, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { useShowcaseMediaPalette } from '@/features/guest/marketing/showcase/hooks/useShowcaseMediaPalette';
import { resolveShowcaseEditorStyleFields } from '@/features/guest/marketing/showcase/lib/showcaseEditorStyleFields';
import { scrollShowcaseToTop } from '@/features/guest/marketing/showcase/lib/showcaseScroll';
import type { ShowcaseTemplateKey } from '@/features/guest/marketing/showcase/types/showcase';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';
import { mapStayGuideData } from '@/features/guest/stay-guide/lib/mapStayGuideData';
import {
  STAY_GUIDE_SECTION_IDS,
  isStayGuideChapterSectionId,
  type StayGuideSectionId,
} from '@/features/guest/stay-guide/lib/stayGuideConfig';

import type { PropertyTemplateDto } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { StyleSection } from '@/features/dashboard/marketing/components/calendar-builder/components/panels/StyleSection';
import { CopyOverrideField } from '@/features/dashboard/page-editor/components/shared/CopyOverrideField';
import { HeroEyebrowField } from '@/features/dashboard/page-editor/components/shared/HeroEyebrowField';
import { ImageSlotPicker } from '@/features/dashboard/page-editor/components/shared/ImageSlotPicker';
import { SectionReorderList } from '@/features/dashboard/page-editor/components/shared/SectionReorderList';
import {
  MotionControl,
  PaletteControl,
  TypographyControl,
} from '@/features/dashboard/page-editor/components/shared/StyleControls';
import {
  StayGuideSectionContentCard,
  type StayGuideSectionDraft,
} from '@/features/dashboard/page-editor/components/stay-guide/StayGuideSectionContentCard';
import { StayGuideTemplatePicker } from '@/features/dashboard/page-editor/components/stay-guide/StayGuideTemplatePicker';
import {
  PageEditorRevealTarget,
  usePageEditorPreviewScroll,
} from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';
import {
  STAY_GUIDE_CHAPTER_SECTIONS,
  STAY_GUIDE_SECTION_LABELS,
} from '@/features/dashboard/page-editor/lib/stayGuideChapterSections';
import { useStayGuideEditorStore } from '@/features/dashboard/page-editor/stores/stayGuideEditorStore';

import { cn } from '@/lib/utils';

type Props = {
  templatesByKey: Record<string, PropertyTemplateDto>;
  drafts: Record<string, StayGuideSectionDraft>;
  onDraftChange: (templateKey: string, draft: StayGuideSectionDraft) => void;
  onResetSection: (templateKey: string) => void;
  contentBusy?: boolean;
  previewDto: GuestStayGuideDto;
  propertyImages: string[];
  propertyBrandColor?: string | null;
};

const COPY_FIELDS: Record<StayGuideSectionId, { heading: boolean; subheading: boolean }> = {
  hero: { heading: true, subheading: true },
  passCard: { heading: true, subheading: true },
  checkInDocuments: { heading: true, subheading: true },
  gallery: { heading: true, subheading: true },
  quickNav: { heading: false, subheading: false },
  'getting-in': { heading: true, subheading: false },
  'make-yourself-at-home': { heading: true, subheading: false },
  'before-you-go': { heading: true, subheading: false },
  host: { heading: true, subheading: true },
};

export function StayGuideEditorPanel({
  templatesByKey,
  drafts,
  onDraftChange,
  onResetSection,
  contentBusy,
  previewDto,
  propertyImages,
  propertyBrandColor,
}: Props) {
  const config = useStayGuideEditorStore((s) => s.config);
  const templateKey = useStayGuideEditorStore((s) => s.templateKey);
  const setTemplateKey = useStayGuideEditorStore((s) => s.setTemplateKey);
  const setSectionVisible = useStayGuideEditorStore((s) => s.setSectionVisible);
  const reorderSections = useStayGuideEditorStore((s) => s.reorderSections);
  const setSectionCopy = useStayGuideEditorStore((s) => s.setSectionCopy);
  const setSectionImageSlots = useStayGuideEditorStore((s) => s.setSectionImageSlots);
  const setSectionHeroEyebrow = useStayGuideEditorStore((s) => s.setSectionHeroEyebrow);
  const setSectionAccent = useStayGuideEditorStore((s) => s.setSectionAccent);
  const setPalette = useStayGuideEditorStore((s) => s.setPalette);
  const setTypography = useStayGuideEditorStore((s) => s.setTypography);
  const setMotion = useStayGuideEditorStore((s) => s.setMotion);

  const [openSection, setOpenSection] = useState<StayGuideSectionId | null>('hero');
  const [openContentKey, setOpenContentKey] = useState<string | null>(null);
  const previewScroll = usePageEditorPreviewScroll();

  const handleTemplateChange = useCallback(
    (next: ShowcaseTemplateKey) => {
      setTemplateKey(next);
      const scrollToTop = () => {
        previewScroll?.scrollToTop('auto');
        scrollShowcaseToTop('auto');
      };
      window.requestAnimationFrame(scrollToTop);
      window.setTimeout(scrollToTop, 120);
    },
    [previewScroll, setTemplateKey]
  );

  const styleFields = resolveShowcaseEditorStyleFields(templateKey);
  const { palette: mediaPalette } = useShowcaseMediaPalette(
    propertyImages,
    propertyImages.length > 0
  );

  const orderedSections = useMemo(
    () => [...config.sections].sort((a, b) => a.order - b.order),
    [config.sections]
  );

  /** Resolved default heading/subheading per section — the field placeholder / baseline. */
  const baselineCopy = useMemo(() => {
    const stripped = {
      ...config,
      sections: config.sections.map((s) => ({ ...s, copy: undefined })),
    };
    const resolved = mapStayGuideData({
      dto: previewDto,
      config: stripped,
      previewPlaceholders: true,
    });
    const map = new Map<string, { heading?: string; subheading?: string }>();
    for (const s of resolved.sections) {
      map.set(s.id, { heading: s.heading, subheading: s.subheading });
    }
    return map;
  }, [previewDto, templateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-w-0">
      <StyleSection title="Template" defaultOpen>
        <StayGuideTemplatePicker
          value={templateKey}
          onChange={handleTemplateChange}
          dto={previewDto}
          config={config}
        />
      </StyleSection>

      <StyleSection title="Sections">
        <SectionReorderList
          items={orderedSections.map((section) => ({
            id: section.id,
            label: STAY_GUIDE_SECTION_LABELS[section.id] ?? section.id,
            visible: section.visible,
            lockedVisible: section.id === 'hero',
          }))}
          onReorder={(ids) => reorderSections(ids as StayGuideSectionId[])}
          onVisibilityChange={(id, visible) => setSectionVisible(id as StayGuideSectionId, visible)}
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

      <StyleSection title="Section details" defaultOpen keepChildrenMounted>
        <div className="space-y-2 px-4 pb-4 pt-1">
          {STAY_GUIDE_SECTION_IDS.map((id) => {
            const section = config.sections.find((entry) => entry.id === id);
            if (!section) return null;
            const fields = COPY_FIELDS[id];
            if (id === 'quickNav') return null;
            const open = openSection === id;
            const isChapter = isStayGuideChapterSectionId(id);
            return (
              <PageEditorRevealTarget key={id} anchor={id}>
                <div className="border-border overflow-hidden rounded-xl border">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm font-medium"
                    onClick={() => setOpenSection(open ? null : id)}
                    aria-expanded={open}
                  >
                    {STAY_GUIDE_SECTION_LABELS[id] ?? id}
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
                          developmentAvailable={false}
                          label="Above heading"
                          idPrefix="stay-guide-hero-eyebrow"
                        />
                      ) : null}
                      {fields.heading || fields.subheading ? (
                        <CopyOverrideField
                          idPrefix={`stay-guide-${id}-copy`}
                          value={{
                            heading: section.copy?.heading ?? baselineCopy.get(id)?.heading,
                            subheading:
                              section.copy?.subheading ?? baselineCopy.get(id)?.subheading,
                          }}
                          showHeading={fields.heading}
                          showSubheading={fields.subheading}
                          showBody={false}
                          onChange={(copy) => {
                            const base = baselineCopy.get(id);
                            setSectionCopy(id, {
                              heading:
                                copy.heading && copy.heading !== base?.heading
                                  ? copy.heading
                                  : undefined,
                              subheading:
                                copy.subheading && copy.subheading !== base?.subheading
                                  ? copy.subheading
                                  : undefined,
                            });
                          }}
                        />
                      ) : null}
                      {id === 'hero' || id === 'gallery' ? (
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
                      {isChapter ? (
                        <>
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <span className="text-muted-foreground">Accent color</span>
                            <input
                              type="color"
                              value={section.accentColor ?? '#000000'}
                              onChange={(e) => setSectionAccent(id, e.target.value)}
                              className="h-7 w-10 cursor-pointer rounded border"
                              aria-label={`${STAY_GUIDE_SECTION_LABELS[id]} accent color`}
                            />
                            {section.accentColor ? (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground text-xs underline"
                                onClick={() => setSectionAccent(id, null)}
                              >
                                Reset
                              </button>
                            ) : null}
                          </label>
                          <div className="space-y-2">
                            {(STAY_GUIDE_CHAPTER_SECTIONS[id] ?? []).map((entry) => {
                              const template = templatesByKey[entry.templateKey];
                              const draft = drafts[entry.templateKey];
                              if (!template || !draft) return null;
                              return (
                                <StayGuideSectionContentCard
                                  key={entry.templateKey}
                                  template={template}
                                  draft={draft}
                                  open={openContentKey === entry.templateKey}
                                  onOpenChange={(next) =>
                                    setOpenContentKey(next ? entry.templateKey : null)
                                  }
                                  onDraftChange={(next) => onDraftChange(entry.templateKey, next)}
                                  onResetToDefault={() => onResetSection(entry.templateKey)}
                                  disabled={contentBusy}
                                  previewAnchor={id}
                                />
                              );
                            })}
                          </div>
                        </>
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
