import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';

/**
 * Deterministic layout QA for compiled posters (plan Phase 7.1). Runs on the
 * document model, so it works in unit tests and before anything is rendered.
 * Catches the failures that make a post look broken: text off canvas, text boxes
 * colliding, and copy too small to read on a phone.
 */

export type PosterAuditIssue = {
  kind:
    | 'out-of-bounds'
    | 'text-overlap'
    | 'text-too-small'
    | 'text-overflow'
    | 'empty-text'
    | 'invalid-geometry';
  element: string;
  detail: string;
};

type Box = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowOverlap: boolean;
};

/** ~19px on a 1080 canvas: the smallest size that still reads in a phone feed. */
const MIN_FONT_RATIO = 0.0175;
const EDGE_TOLERANCE = 2;

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Approximate ink box for a text node: aligned lines rarely fill the whole width. */
function textInkBox(child: Record<string, unknown>): Box {
  const x = Number(child.x);
  const width = Number(child.width);
  const fontSize = Number(child.fontSize);
  const lines = String(child.text ?? '').split('\n');
  const longest = Math.max(...lines.map((line) => line.length));
  const estimated = Math.min(width, longest * fontSize * 0.6);
  const align = child.align ?? 'center';
  const inkX =
    align === 'left' ? x : align === 'right' ? x + width - estimated : x + (width - estimated) / 2;
  return {
    name: String(child.name ?? child.id),
    x: inkX,
    y: Number(child.y),
    width: estimated,
    height: Number(child.height),
    allowOverlap: Boolean(
      (child.custom as { posterSlot?: { allowOverlap?: boolean } } | undefined)?.posterSlot
        ?.allowOverlap
    ),
  };
}

export function auditPosterDocument(document: PolotnoDesignDocument): PosterAuditIssue[] {
  const issues: PosterAuditIssue[] = [];
  const { width: W, height: H } = document;
  const minFont = Math.min(W, H) * MIN_FONT_RATIO;
  const texts: Box[] = [];

  for (const page of document.pages) {
    for (const child of page.children) {
      const name = String(child.name ?? child.id);
      const x = Number(child.x);
      const y = Number(child.y);
      const width = Number(child.width);
      const height = Number(child.height);
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height < 0) {
        issues.push({
          kind: 'invalid-geometry',
          element: name,
          detail: `${x},${y} ${width}x${height}`,
        });
        continue;
      }
      // Full-bleed photos and scrims may legitimately touch or exceed the edges.
      const isBackdrop = child.type === 'image' && /photo/i.test(name);
      const isScrim = /scrim/i.test(name);
      if (!isBackdrop && !isScrim) {
        if (
          x < -EDGE_TOLERANCE ||
          y < -EDGE_TOLERANCE ||
          x + width > W + EDGE_TOLERANCE ||
          y + height > H + EDGE_TOLERANCE
        ) {
          issues.push({
            kind: 'out-of-bounds',
            element: name,
            detail: `box ${Math.round(x)},${Math.round(y)} ${Math.round(width)}x${Math.round(height)} on ${W}x${H}`,
          });
        }
      }
      if (child.type === 'text') {
        if (!String(child.text ?? '').trim()) {
          issues.push({ kind: 'empty-text', element: name, detail: 'no text' });
          continue;
        }
        if (Number(child.fontSize) < minFont) {
          issues.push({
            kind: 'text-too-small',
            element: name,
            detail: `${child.fontSize}px < ${Math.round(minFont)}px`,
          });
        }
        const slot = (child.custom as { posterSlot?: { overflow?: boolean } } | undefined)
          ?.posterSlot;
        if (slot?.overflow) {
          issues.push({ kind: 'text-overflow', element: name, detail: 'copy exceeds its slot' });
        }
        texts.push(textInkBox(child));
      }
    }
  }

  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i]!;
      const b = texts[j]!;
      if (a.allowOverlap || b.allowOverlap) continue;
      const area = overlapArea(a, b);
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (smaller > 0 && area / smaller > 0.12) {
        issues.push({
          kind: 'text-overlap',
          element: `${a.name} × ${b.name}`,
          detail: `${Math.round((area / smaller) * 100)}% of the smaller box`,
        });
      }
    }
  }
  return issues;
}
