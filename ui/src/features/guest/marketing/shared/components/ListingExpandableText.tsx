import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  text: string;
  maxLines?: number;
  className?: string;
  collapsedLabel?: string;
  expandedLabel?: string;
};

const TEXT_CLASS = 'text-muted-foreground whitespace-pre-line leading-relaxed mb-2';

export function ListingExpandableText({
  text,
  maxLines = 8,
  className,
  collapsedLabel = 'Read more',
  expandedLabel = 'Read less',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState<number | null>(null);
  const measureRef = useRef<HTMLParagraphElement>(null);

  const measureOverflow = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;

    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

    const maxHeight = Math.ceil(lineHeight * maxLines);
    const fullHeight = el.scrollHeight;
    setCollapsedMaxHeight(maxHeight);
    setOverflows(fullHeight > maxHeight + 1);
  }, [maxLines, text]);

  useLayoutEffect(() => {
    measureOverflow();
  }, [measureOverflow]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => measureOverflow());
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [measureOverflow]);

  const showToggle = overflows || expanded;

  return (
    <div className="relative">
      {/* Full-height mirror for measurement — line-clamp breaks with whitespace-pre-line. */}
      <p
        ref={measureRef}
        aria-hidden
        className={cn(
          TEXT_CLASS,
          'pointer-events-none invisible absolute inset-x-0 top-0 -z-10',
          className
        )}
      >
        {text}
      </p>

      <p
        className={cn(TEXT_CLASS, className)}
        style={
          !expanded && collapsedMaxHeight != null
            ? { maxHeight: collapsedMaxHeight, overflow: 'hidden' }
            : undefined
        }
      >
        {text}
      </p>

      {showToggle ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="mt-2 min-h-[44px] w-full gap-2 rounded-xl sm:w-auto"
        >
          {expanded ? expandedLabel : collapsedLabel}
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', expanded ? '-rotate-90' : 'rotate-90')}
            aria-hidden
          />
        </Button>
      ) : null}
    </div>
  );
}
