import type { ComponentType } from 'react';

import type { Format, FormatId } from '../theme';
import { ASK_VIDEO, AskConcept } from './ask';
import { MEET_SLIDES, MeetSlide } from './carousel';
import { CARRY_VIDEO, CarryConcept } from './carry';
import { CREW_VIDEO, CrewConcept } from './crew';
import { MEET_VIDEO, MeetConcept } from './meet';
import { NIGHT_VIDEO, NightConcept } from './night';
import { REEL_VIDEO, ReelConcept } from './reel';

type ConceptC = ComponentType<{ format: Format; frame?: number }>;

/**
 * Campaign 3: Kame, the v6 mascot, carries the features. Ids continue the campaign
 * numbering: `still-<id>-<format>`, `video-<id>-<format>`, carousels `still-<id>-<n>`.
 */
export const mascotStills: [string, ConceptC, FormatId[]][] = [
  ['17-meet-kame', MeetConcept, ['story', 'portrait', 'square', 'landscape', 'link', 'email']],
  ['18-carry', CarryConcept, ['story', 'portrait', 'square', 'landscape', 'email']],
  ['19-night-shift', NightConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['20-ask-kame', AskConcept, ['story', 'portrait', 'square', 'landscape']],
  ['21-crew', CrewConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
];

export const mascotCarousels: [string, number, ComponentType<{ index: number; format: Format }>][] =
  [['22-meet-carousel', MEET_SLIDES, MeetSlide]];

/** [id, concept, formats, body frames before the offer end card] */
export const mascotVideos: [string, ConceptC, FormatId[], number][] = [
  ['17-meet-kame', MeetConcept, ['story', 'square', 'landscape'], MEET_VIDEO],
  ['18-carry', CarryConcept, ['story', 'landscape'], CARRY_VIDEO],
  ['19-night-shift', NightConcept, ['story', 'square'], NIGHT_VIDEO],
  ['20-ask-kame', AskConcept, ['story', 'portrait'], ASK_VIDEO],
  ['21-crew', CrewConcept, ['landscape', 'square'], CREW_VIDEO],
  ['23-kame-reel', ReelConcept, ['story', 'square'], REEL_VIDEO],
];
