import { cn } from '@/lib/utils';

type Size = 'sm' | 'md';

const dotSizeClasses: Record<Size, string> = {
  sm: 'size-4',
  md: 'size-[18px]',
};

export function PaletteSwatchDots({
  colors,
  size = 'sm',
  className,
}: {
  colors: string[];
  size?: Size;
  className?: string;
}) {
  const unique = [...new Set(colors.filter(Boolean))].slice(0, 5);
  if (unique.length === 0) return null;

  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} aria-hidden>
      {unique.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className={cn(
            dotSizeClasses[size],
            'rounded-full border border-white/90 shadow-sm ring-1 ring-black/[0.06]',
            index > 0 && (size === 'sm' ? '-ml-1.5' : '-ml-1')
          )}
          style={{ backgroundColor: color, zIndex: unique.length - index }}
        />
      ))}
    </span>
  );
}

export function AccentPreviewDot({
  color,
  size = 'sm',
  className,
}: {
  color: string;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'border-border inline-block shrink-0 rounded-full border shadow-sm',
        size === 'sm' ? 'size-5' : 'size-6',
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export function PaletteOptionLabel({
  colors,
  label,
  dotSize = 'sm',
}: {
  colors: string[];
  label: string;
  dotSize?: Size;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <PaletteSwatchDots colors={colors} size={dotSize} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function AccentOptionLabel({
  color,
  label,
  dotSize = 'sm',
}: {
  color: string;
  label: string;
  dotSize?: Size;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <AccentPreviewDot color={color} size={dotSize} />
      <span className="truncate">{label}</span>
    </span>
  );
}
