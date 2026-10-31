import type { ComponentType } from 'react';

import { makeKineticConcept, makeManifestoConcept, KINETIC_VIDEO } from '../angles/kinetic';
import { makeQuestionConcept } from '../angles/question';
import { makePhoneConcept, OfferConcept } from '../concepts';
import { makeFeatureConcept, type FeatureSpec } from '../features/concept';
import { makeHookConcept, makeKitSlide, makeReelConcept, type KitSpec } from '../features/extras';
import { kitCopy, type Step } from '../features/kitCopy';
import { featureSpecs } from '../features/registry';
import { LockScreen } from '../screens';
import { c, type Format, type FormatId } from '../theme';
import { BAHALA_VIDEO, BahalaConcept } from './bahala';
import { featureCopy, lockFilipino, manifestoFilipino, questionFilipino } from './copy';
import { NOON_VIDEO, NoonNgayonConcept } from './noonNgayon';

type ConceptC = ComponentType<{ format: Format; frame?: number }>;

/* ------------------------------------------------------------------ *
 * Feature kits: same modules, layouts and screens as English, Taglish copy.
 * ------------------------------------------------------------------ */

export const filipinoFeatureSpecs: FeatureSpec[] = featureSpecs.map((spec) => {
  const f = featureCopy[spec.slug];
  return {
    ...spec,
    tall: f.tall,
    wide: f.wide,
    accentTall: f.accentTall,
    accentWide: f.accentWide,
    sub: f.sub,
  };
});

export const filipinoFeatures = filipinoFeatureSpecs.map((spec) => {
  const f = featureCopy[spec.slug];
  const steps = kitCopy[spec.slug].steps.map((st, i) => ({
    icon: st.icon,
    title: f.steps[i][0],
    text: f.steps[i][1],
  })) as [Step, Step, Step];
  const kit: KitSpec = { ...spec, hook: f.hook, hookWide: f.hookWide, answer: f.answer, steps };
  return {
    spec,
    Concept: makeFeatureConcept(spec),
    Hook: makeHookConcept(kit),
    Slide: makeKitSlide(kit),
    Reel: makeReelConcept(kit),
  };
});

/* ------------------------------------------------------------------ *
 * Campaign: Filipino-first concepts. Ids: `still-fil-<id>-<format>`.
 * ------------------------------------------------------------------ */

const TulogConcept = makePhoneConcept({
  tone: 'tint',
  tall: lockFilipino.tall,
  wide: lockFilipino.wide,
  accentTall: 1,
  accentWide: 1,
  sub: lockFilipino.sub,
  screen: (f, s) => <LockScreen frame={f} startAt={s} />,
  screenBg: c.brandDeep,
});

const ManifestoFil = makeManifestoConcept(manifestoFilipino);
const KineticFil = makeKineticConcept(manifestoFilipino);
const QuestionFil = makeQuestionConcept(questionFilipino);

export const filipinoStills: [string, ConceptC, FormatId[]][] = [
  ['01-kame-na-bahala', BahalaConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['02-noon-ngayon', NoonNgayonConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['03-tulog-ka', TulogConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['04-manifesto', ManifestoFil, ['story', 'portrait', 'square']],
  ['05-tanong', QuestionFil, ['story', 'portrait', 'square']],
  ['06-offer', OfferConcept, ['story', 'portrait', 'square', 'landscape', 'link', 'email']],
];

/** [id, concept, formats, body frames before the offer end card] */
export const filipinoVideos: [string, ConceptC, FormatId[], number][] = [
  ['01-kame-na-bahala', BahalaConcept, ['story', 'square', 'landscape'], BAHALA_VIDEO],
  ['02-noon-ngayon', NoonNgayonConcept, ['story', 'square'], NOON_VIDEO],
  ['03-tulog-ka', TulogConcept, ['story', 'square'], 200],
  ['04-kinetic', KineticFil, ['story', 'square'], KINETIC_VIDEO],
];
