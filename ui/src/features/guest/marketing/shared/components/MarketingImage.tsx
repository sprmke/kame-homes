import { cn } from '@/lib/utils';

interface MarketingImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
}

/** Vite/React substitute for Next.js `Image` used by PMA marketing components. */
export function MarketingImage({
  src,
  alt,
  fill,
  className,
  priority,
  width,
  height,
}: MarketingImageProps) {
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn('absolute inset-0 h-full w-full', className)}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
    />
  );
}
