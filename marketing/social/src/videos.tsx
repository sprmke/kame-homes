import type { ComponentType } from 'react';

import { AbsoluteFill, useCurrentFrame } from 'remotion';

import { BentoConcept, FinanceConcept, InboxConcept, LockConcept, OfferConcept, PathConcept } from './concepts';
import { ease, EASE_IN_OUT } from './motion';
import { type Format } from './theme';

type ConceptC = ComponentType<{ format: Format; frame?: number }>;

/** Total length of a video: the concept plays, then cross-fades into the offer end card. */
export const videoLength = (body: number) => body + END;
const END = 96;
const FADE = 14;

/** Factory: concept animated for `body` frames, then the shared "Start free." end card. */
export function makeVideo(Concept: ConceptC, format: Format, body: number) {
  return function Video() {
    const frame = useCurrentFrame();
    const out = ease(frame, body - FADE, body, EASE_IN_OUT);
    return (
      <AbsoluteFill>
        {out < 1 ? <Concept format={format} frame={frame} /> : null}
        {frame >= body - FADE ? (
          <AbsoluteFill style={{ opacity: out }}>
            <OfferConcept format={format} frame={frame - (body - FADE)} />
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    );
  };
}

export const videoConcepts: [string, ConceptC, ('story' | 'square' | 'landscape' | 'portrait')[], number][] = [
  ['01-lockscreen', LockConcept, ['story', 'square'], 200],
  ['02-path', PathConcept, ['story', 'landscape'], 210],
  ['03-bento', BentoConcept, ['landscape', 'square'], 170],
  ['05-inbox', InboxConcept, ['story'], 200],
  ['06-finance', FinanceConcept, ['portrait'], 180],
];
