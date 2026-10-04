import type { ComponentType } from 'react';

import { Composition, Folder, Still } from 'remotion';

import {
  BentoConcept,
  FinanceConcept,
  InboxConcept,
  LockConcept,
  OfferConcept,
  PANO_SLIDES,
  PanoSlide,
  PathConcept,
  SplitConcept,
} from './concepts';
import { features } from './features/registry';
import { formats, FPS, type Format, type FormatId } from './theme';
import { makeVideo, videoConcepts, videoLength } from './videos';

type ConceptC = ComponentType<{ format: Format; frame?: number }>;

/** Campaign matrix: concept → the formats it ships in. Ids: `still-<concept>-<format>`. */
const campaign: [string, ConceptC, FormatId[]][] = [
  ['01-lockscreen', LockConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['02-path', PathConcept, ['story', 'portrait', 'square', 'landscape', 'email']],
  ['03-bento', BentoConcept, ['portrait', 'square', 'landscape', 'link', 'email']],
  ['04-before-after', SplitConcept, ['story', 'portrait', 'square', 'landscape', 'link']],
  ['05-inbox', InboxConcept, ['story', 'portrait', 'square', 'landscape']],
  ['06-finance', FinanceConcept, ['story', 'portrait', 'square', 'landscape']],
  ['07-offer', OfferConcept, ['story', 'portrait', 'square', 'landscape', 'link', 'email']],
];

/** Feature series: every module ships these stills and videos. */
const FEATURE_STILLS: FormatId[] = ['story', 'portrait', 'square', 'landscape'];
const FEATURE_VIDEOS: FormatId[] = ['story', 'landscape'];

export function Root() {
  return (
    <>
      {campaign.map(([id, C, fmts]) => (
        <Folder key={id} name={`c${id}`}>
          {fmts.map((fid) => {
            const fmt = formats[fid];
            const Comp = () => <C format={fmt} />;
            return <Still key={fid} id={`still-${id}-${fid}`} component={Comp} width={fmt.width} height={fmt.height} />;
          })}
        </Folder>
      ))}
      <Folder name="c08-carousel">
        {Array.from({ length: PANO_SLIDES }, (_, i) => {
          const Comp = () => <PanoSlide index={i} format={formats.portrait} />;
          return <Still key={i} id={`still-08-carousel-${i + 1}`} component={Comp} width={1080} height={1350} />;
        })}
      </Folder>
      <Folder name="features">
        {features.map(({ spec, Concept }) => (
          <Folder key={spec.slug} name={`f${spec.slug}`}>
            {FEATURE_STILLS.map((fid) => {
              const fmt = formats[fid];
              const Comp = () => <Concept format={fmt} />;
              return (
                <Still
                  key={fid}
                  id={`still-feature-${spec.slug}-${fid}`}
                  component={Comp}
                  width={fmt.width}
                  height={fmt.height}
                />
              );
            })}
            {FEATURE_VIDEOS.map((fid) => {
              const fmt = formats[fid];
              return (
                <Composition
                  key={`v-${fid}`}
                  id={`video-feature-${spec.slug}-${fid}`}
                  component={makeVideo(Concept, fmt, spec.video)}
                  durationInFrames={videoLength(spec.video)}
                  fps={FPS}
                  width={fmt.width}
                  height={fmt.height}
                />
              );
            })}
          </Folder>
        ))}
      </Folder>
      <Folder name="videos">
        {videoConcepts.flatMap(([id, C, fmts, body]) =>
          fmts.map((fid) => {
            const fmt = formats[fid];
            return (
              <Composition
                key={`${id}-${fid}`}
                id={`video-${id}-${fid}`}
                component={makeVideo(C, fmt, body)}
                durationInFrames={videoLength(body)}
                fps={FPS}
                width={fmt.width}
                height={fmt.height}
              />
            );
          }),
        )}
      </Folder>
    </>
  );
}
