import { Fragment, useMemo } from 'react';

import { cn } from '@/lib/utils';

type Segment = {
  text: string;
  match: boolean;
  active: boolean;
};

function buildSegments(
  text: string,
  query: string,
  activeRange: { start: number; end: number } | null | undefined
): Segment[] {
  const q = query.trim();
  if (!q) return [{ text, match: false, active: false }];

  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = lower.indexOf(lowerQ, cursor);
    if (index === -1) {
      segments.push({ text: text.slice(cursor), match: false, active: false });
      break;
    }

    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), match: false, active: false });
    }

    const end = index + q.length;
    const active = Boolean(activeRange && activeRange.start === index && activeRange.end === end);
    segments.push({ text: text.slice(index, end), match: true, active });
    cursor = end;
  }

  return segments.length ? segments : [{ text, match: false, active: false }];
}

type Props = {
  text: string;
  query?: string;
  activeRange?: { start: number; end: number } | null;
  outbound?: boolean;
  className?: string;
};

export function ChatHighlightedText({
  text,
  query = '',
  activeRange = null,
  outbound = false,
  className,
}: Props) {
  const segments = useMemo(
    () => buildSegments(text, query, activeRange),
    [text, query, activeRange]
  );

  return (
    <p className={cn('whitespace-pre-wrap break-words', className)}>
      {segments.map((segment, index) => {
        if (!segment.match) {
          return <Fragment key={`${index}-${segment.text.slice(0, 8)}`}>{segment.text}</Fragment>;
        }

        return (
          <mark
            key={`${index}-${segment.text}`}
            className={cn(
              'rounded-sm px-0.5 text-inherit',
              outbound
                ? segment.active
                  ? 'bg-primary-foreground/50 ring-primary-foreground/70 ring-1'
                  : 'bg-primary-foreground/25'
                : segment.active
                  ? 'text-foreground bg-amber-400/90 ring-1 ring-amber-600/40'
                  : 'text-foreground bg-amber-200/90'
            )}
          >
            {segment.text}
          </mark>
        );
      })}
    </p>
  );
}
