import { MessageCircle } from 'lucide-react';

import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, Frame, Kicker, useFrameCtx, Wordmark } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { TopBar } from './shared';

/**
 * 15 · Question post. Engagement format: one relatable question, four answers, comment a
 * letter. Three answers are the messy status quo; the last is the product, set apart.
 */

export interface QuestionCopy {
  kicker: string;
  /** Two lines; the second is the accent. */
  lines: string[];
  /** A to D. The last one is the product answer. */
  options: string[];
  comment: string;
}

export const questionEnglish: QuestionCopy = {
  kicker: 'Quick question for hosts',
  lines: ['Where do guest', 'receipts end up?'],
  options: [
    'A Messenger thread',
    'My camera roll',
    'A Drive folder somewhere',
    'Matched to the booking in Kame Space',
  ],
  comment: 'Comment a letter',
};

function Option({
  letter,
  text,
  k,
  last,
  frame,
  i,
}: {
  letter: string;
  text: string;
  k: number;
  last: boolean;
  frame: number;
  i: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24 * k,
        height: 112 * k,
        padding: `0 ${30 * k}px`,
        borderRadius: 30 * k,
        background: last ? c.brand : c.white,
        color: last ? c.white : c.ink,
        ...reveal(frame, 24 + i * 8, 18, 18),
      }}
    >
      <span
        style={{
          width: 58 * k,
          height: 58 * k,
          flex: 'none',
          borderRadius: 18 * k,
          display: 'grid',
          placeItems: 'center',
          fontSize: 28 * k,
          fontWeight: 800,
          background: last ? c.white : c.tint,
          color: last ? c.brandDeep : c.brandDeep,
        }}
      >
        {letter}
      </span>
      <span
        style={{
          fontSize: 33 * k,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}

function QuestionBody({ copy, frame }: { copy: QuestionCopy; frame: number }) {
  const { kind, W, H, M, t } = useFrameCtx();
  const vertical = kind === 'vertical';
  const square = kind === 'square';
  const top = vertical ? STORY_SAFE.top : M;
  const size = vertical ? 120 : square ? 84 : 104;
  const k = vertical ? 1.12 : square ? 0.88 : 1.04;
  const listY = vertical ? top + 470 : square ? M + 260 : 520;
  const gap = 18 * k;
  return (
    <>
      {square ? null : <TopBar y={top} />}
      <Box x={M} y={square ? M : top + (vertical ? 110 : 100)}>
        {square ? null : <Kicker style={{ marginBottom: 28 }}>{copy.kicker}</Kicker>}
        <Lines
          lines={copy.lines}
          accentFrom={1}
          size={size}
          frame={frame}
          delay={2}
        />
      </Box>
      <Box x={M} y={listY} w={W - M * 2} style={{ display: 'flex', flexDirection: 'column', gap }}>
        {copy.options.map((txt, i) => (
          <Option
            key={txt}
            letter={'ABCD'[i]}
            text={txt}
            k={k}
            last={i === copy.options.length - 1}
            frame={frame}
            i={i}
          />
        ))}
      </Box>
      <Box
        x={M}
        y={vertical ? listY + 4 * (112 * k + gap) + 16 : H - M - 34}
        w={W - M * 2}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          ...reveal(frame, 60),
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 30,
            fontWeight: 700,
            color: t.fg,
          }}
        >
          <MessageCircle size={30} strokeWidth={2.4} color={c.brandDeep} /> {copy.comment}
        </span>
        {square ? <Wordmark /> : null}
      </Box>
    </>
  );
}

export function makeQuestionConcept(copy: QuestionCopy) {
  return function Question({ format, frame = SETTLED }: { format: Format; frame?: number }) {
    return (
      <Frame format={format} tone="tint">
        <QuestionBody copy={copy} frame={frame} />
      </Frame>
    );
  };
}

export const QuestionConcept = makeQuestionConcept(questionEnglish);
