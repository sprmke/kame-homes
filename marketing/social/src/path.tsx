import { Check } from 'lucide-react';

import { ease, SETTLED } from './motion';
import { c } from './theme';

/**
 * "The Path": the campaign's brand device. A thick line with diamond nodes, one per booking
 * stage. It bleeds off the canvas edges and can continue across carousel slides.
 */

export const STAGES = [
  { label: 'Booked', note: 'Form, ID, payment' },
  { label: 'Documents', note: 'GAF and pet approval' },
  { label: 'Check-in', note: 'Guide sent' },
  { label: 'Check-out', note: 'Turnover scheduled' },
  { label: 'Deposit', note: 'Refund on time' },
  { label: 'Completed', note: 'Income recorded' },
];

export interface PathColors {
  track: string;
  done: string;
  /** Fill inside an upcoming node (usually the background). */
  bg: string;
  label: string;
  note: string;
  /** Mark color inside a done node. */
  mark: string;
}

interface Node {
  /** Position along the line in px (x for horizontal, y for vertical), relative to the line's origin. */
  at: number;
  label?: string;
  note?: string;
}

interface PathProps {
  /** Line origin (top-left of the line box) in design px. */
  x: number;
  y: number;
  /** Line length in px. Can exceed the canvas to bleed. */
  length: number;
  nodes: Node[];
  /** Index of the current node. Nodes before it are done. -1 for none. */
  active: number;
  colors: PathColors;
  vertical?: boolean;
  thickness?: number;
  node?: number;
  labelSize?: number;
  frame?: number;
  /** Frame the progress fill starts, and frames per node. */
  startAt?: number;
  step?: number;
  /** Where the progress fill begins along the line (defaults to the first node). */
  fillFrom?: number;
}

export function Path({
  x,
  y,
  length,
  nodes,
  active,
  colors,
  vertical = false,
  thickness = 10,
  node = 46,
  labelSize = 30,
  frame = SETTLED,
  startAt = 0,
  step = 18,
  fillFrom,
}: PathProps) {
  const from = fillFrom ?? nodes[0]?.at ?? 0;
  const target = active >= 0 ? nodes[Math.min(active, nodes.length - 1)].at : from;
  const p = ease(frame, startAt, startAt + Math.max(1, active) * step + 10);
  const fillTo = from + (target - from) * p;
  const reached = (i: number) => nodes[i].at <= fillTo + 0.5;

  const line = (a: number, b: number, color: string) =>
    vertical ? (
      <div
        style={{
          position: 'absolute',
          left: x - thickness / 2,
          top: y + a,
          width: thickness,
          height: Math.max(0, b - a),
          background: color,
          borderRadius: thickness,
        }}
      />
    ) : (
      <div
        style={{
          position: 'absolute',
          left: x + a,
          top: y - thickness / 2,
          width: Math.max(0, b - a),
          height: thickness,
          background: color,
          borderRadius: thickness,
        }}
      />
    );

  return (
    <>
      {line(0, length, colors.track)}
      {line(from, fillTo, colors.done)}
      {nodes.map((n, i) => {
        const done = i < active && reached(i);
        const current = i === active && reached(i);
        const cx = vertical ? x : x + n.at;
        const cy = vertical ? y + n.at : y;
        const appear = ease(frame, startAt + i * step - 6, startAt + i * step + 10);
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: cx - node / 2,
                top: cy - node / 2,
                width: node,
                height: node,
                transform: 'rotate(45deg)',
                borderRadius: node * 0.2,
                background: done ? colors.done : current ? colors.bg : colors.bg,
                border: `${Math.round(node * 0.13)}px solid ${done || current ? colors.done : colors.track}`,
                boxShadow: current
                  ? `0 0 0 ${node * 0.28}px color-mix(in srgb, ${colors.done} 22%, transparent)`
                  : undefined,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {done ? (
                <span style={{ transform: 'rotate(-45deg)', display: 'grid', color: colors.mark }}>
                  <Check size={node * 0.5} strokeWidth={3.4} />
                </span>
              ) : current ? (
                <span
                  style={{
                    width: node * 0.26,
                    height: node * 0.26,
                    borderRadius: node * 0.06,
                    background: colors.done,
                  }}
                />
              ) : null}
            </div>
            {n.label ? (
              <div
                style={{
                  position: 'absolute',
                  left: vertical ? cx + node * 0.95 : cx - node / 2 - 2,
                  top: vertical ? cy - labelSize * 0.66 : cy + node * 0.95,
                  whiteSpace: 'nowrap',
                  opacity: frame >= SETTLED ? 1 : appear,
                }}
              >
                <div
                  style={{
                    fontSize: labelSize,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    color: colors.label,
                  }}
                >
                  {n.label}
                </div>
                {n.note ? (
                  <div
                    style={{
                      fontSize: labelSize * 0.72,
                      fontWeight: 500,
                      letterSpacing: '-0.01em',
                      color: colors.note,
                      marginTop: 4,
                    }}
                  >
                    {n.note}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export const pathOnBrand: PathColors = {
  track: c.brandTrack,
  done: c.white,
  bg: c.brand,
  label: c.white,
  note: c.onBrandSub,
  mark: c.brand,
};

export const pathOnPaper: PathColors = {
  track: c.line,
  done: c.brand,
  bg: c.paper,
  label: c.ink,
  note: c.muted,
  mark: c.white,
};

export const pathOnDark: PathColors = {
  track: c.graphiteLine,
  done: c.mint,
  bg: c.night,
  label: c.white,
  note: c.nightSub,
  mark: c.night,
};
