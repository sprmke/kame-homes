import { forwardRef } from 'react';

import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';

import type { SearchField } from '@/features/guest/marketing/guest-landing/lib/heroSearchState';
import { lerp, smoothstep } from '@/features/guest/marketing/shared/lib/listingScrollSearchEasing';

import { cn } from '@/lib/utils';

const PILL_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.82 };

export type SegmentPillBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function ActiveSegmentPill({
  bounds,
  roundedClass,
}: {
  bounds: SegmentPillBounds;
  roundedClass: string;
}) {
  return (
    <motion.div
      aria-hidden
      className={cn('bg-background pointer-events-none absolute z-0 shadow-md', roundedClass)}
      initial={false}
      animate={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
      transition={PILL_SPRING}
    />
  );
}

interface GuestRowProps {
  label: string;
  subtitle?: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
}

export function GuestRow({
  label,
  subtitle,
  value,
  onDecrement,
  onIncrement,
  min = 0,
}: GuestRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">{label}</p>
        {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className={cn(
            'border-border flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border',
            'text-muted-foreground hover:border-foreground/30 transition-colors disabled:opacity-30'
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-foreground w-5 text-center text-sm font-medium tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Increase ${label}`}
          className={cn(
            'border-border flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border',
            'text-muted-foreground hover:border-foreground/30 transition-colors'
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface SearchSegmentProps {
  field: SearchField;
  label: string;
  value: string;
  placeholder: string;
  activeField: SearchField | null;
  onActivate: (field: SearchField) => void;
  className?: string;
  morphProgress?: number;
  compactPlaceholder?: string;
  /** Single-line header / mobile — no Where/When/Who labels. */
  compactLine?: boolean;
}

export const SearchSegment = forwardRef<HTMLButtonElement, SearchSegmentProps>(
  function SearchSegment(
    {
      field,
      label,
      value,
      placeholder,
      activeField,
      onActivate,
      className,
      morphProgress = 0,
      compactPlaceholder,
      compactLine = false,
    },
    ref
  ) {
    const isActive = activeField === field;
    const p = morphProgress;
    const labelOpacity = compactLine ? 0 : 1 - smoothstep(0.05, 0.35, p);
    const isFilled = Boolean(value);
    const display = value || (compactLine ? (compactPlaceholder ?? placeholder) : placeholder);

    if (compactLine) {
      return (
        <button
          ref={ref}
          type="button"
          aria-label={label}
          onClick={() => onActivate(field)}
          className={cn(
            'relative z-[1] flex min-w-0 flex-1 basis-0 items-center justify-center truncate rounded-full px-2 py-2 text-center text-xs',
            className
          )}
        >
          <span
            className={cn(
              'relative truncate',
              isFilled ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium',
              isActive && 'text-foreground font-semibold'
            )}
          >
            {display}
          </span>
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onActivate(field)}
        className={cn(
          'relative z-[1] flex min-h-[52px] min-w-0 flex-1 flex-col justify-center rounded-full px-5 py-3 text-left',
          className
        )}
        style={{
          paddingLeft: `${lerp(25, 14, p)}px`,
          paddingRight: `${lerp(15, 14, p)}px`,
          paddingTop: `${lerp(5, 10, p)}px`,
          paddingBottom: `${lerp(5, 10, p)}px`,
        }}
      >
        {labelOpacity > 0.02 ? (
          <span
            className="text-foreground relative text-xs font-semibold"
            style={{
              opacity: labelOpacity,
              maxHeight: `${labelOpacity * 18}px`,
              overflow: 'hidden',
            }}
          >
            {label}
          </span>
        ) : null}
        <span
          className={cn(
            'relative truncate text-sm',
            labelOpacity > 0.5 && 'mt-0.5',
            isFilled ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium',
            isActive && 'text-foreground font-semibold'
          )}
        >
          {display}
        </span>
      </button>
    );
  }
);
