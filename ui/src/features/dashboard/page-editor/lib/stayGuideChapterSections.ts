import type { StayGuideChapterSectionId } from '@/features/guest/stay-guide/lib/stayGuideConfig';

import { STANDARD_TEMPLATE_SECTIONS } from '@/features/dashboard/bookings/lib/propertyTemplateSections';

import type { LucideIcon } from 'lucide-react';

export type StayGuideEditableSection = {
  templateKey: string;
  label: string;
  icon: LucideIcon;
};

function pick(keys: string[]): StayGuideEditableSection[] {
  return STANDARD_TEMPLATE_SECTIONS.filter((s) => keys.includes(s.templateKey)).map((s) => ({
    templateKey: s.templateKey,
    label: s.label,
    icon: s.icon,
  }));
}

/** Chapter section id → the property-template keys whose rich text it edits. */
export const STAY_GUIDE_CHAPTER_SECTIONS: Record<
  StayGuideChapterSectionId,
  StayGuideEditableSection[]
> = {
  'getting-in': pick(['check-in-instructions']),
  'make-yourself-at-home': pick(['house-rules', 'parking-reminders']),
  'before-you-go': pick(['check-out-instructions']),
};

export const STAY_GUIDE_STANDARD_TEMPLATE_KEYS = Object.values(STAY_GUIDE_CHAPTER_SECTIONS)
  .flat()
  .map((s) => s.templateKey);

export const CHAPTER_LABELS: Record<StayGuideChapterSectionId, string> = {
  'getting-in': 'Getting In',
  'make-yourself-at-home': 'Make Yourself at Home',
  'before-you-go': 'Before You Go',
};

export const STAY_GUIDE_SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  passCard: 'Stay Pass card',
  checkInDocuments: 'Check-in documents',
  gallery: 'Gallery',
  quickNav: 'Quick-nav',
  'getting-in': 'Getting In',
  'make-yourself-at-home': 'Make Yourself at Home',
  'before-you-go': 'Before You Go',
  host: 'Need Anything',
};
