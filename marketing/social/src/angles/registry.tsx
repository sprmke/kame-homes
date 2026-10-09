import type { ComponentType } from 'react';

import type { Format, FormatId } from '../theme';
import { GROUP_CHAT_VIDEO, GroupChatConcept } from './chat';
import { CHECKLIST_SLIDES, ChecklistSlide } from './checklist';
import { DAY_VIDEO, DayConcept } from './day';
import { JOURNEY_VIDEO, JourneyConcept } from './journey';
import { KINETIC_VIDEO, KineticConcept, ManifestoConcept } from './kinetic';
import { QuestionConcept } from './question';
import { TWO_SIDES_VIDEO, TwoSidesConcept } from './twoSides';
import { VersusConcept } from './versus';

type ConceptC = ComponentType<{ format: Format; frame?: number }>;

/**
 * Campaign 2: new angles. Each one borrows a format that works for bigger SaaS brands
 * (relatable pain post, day-in-the-life, comparison table, two-sided product shot,
 * save-worthy checklist carousel, manifesto, engagement question, product walkthrough).
 * Ids continue the campaign numbering: `still-<id>-<format>`, `video-<id>-<format>`.
 */
export const angleStills: [string, ConceptC, FormatId[]][] = [
  ['09-group-chat', GroupChatConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['10-day', DayConcept, ['story', 'portrait', 'square', 'landscape', 'email']],
  ['11-versus', VersusConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['12-two-sides', TwoSidesConcept, ['story', 'portrait', 'square', 'landscape']],
  ['14-manifesto', ManifestoConcept, ['story', 'portrait', 'square']],
  ['15-question', QuestionConcept, ['story', 'portrait', 'square']],
];

/** Carousels: [id, slide count, slide component]. Ids: `still-<id>-<n>`, portrait 4:5. */
export const angleCarousels: [string, number, ComponentType<{ index: number; format: Format }>][] =
  [['13-checklist', CHECKLIST_SLIDES, ChecklistSlide]];

/** [id, concept, formats, body frames before the offer end card] */
export const angleVideos: [string, ConceptC, FormatId[], number][] = [
  ['09-group-chat', GroupChatConcept, ['story', 'square'], GROUP_CHAT_VIDEO],
  ['10-day', DayConcept, ['story', 'landscape'], DAY_VIDEO],
  ['12-two-sides', TwoSidesConcept, ['story', 'landscape'], TWO_SIDES_VIDEO],
  ['14-kinetic', KineticConcept, ['story', 'square'], KINETIC_VIDEO],
  ['16-journey', JourneyConcept, ['story', 'landscape'], JOURNEY_VIDEO],
];
