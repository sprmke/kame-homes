import { useState } from 'react';

import { Play } from 'lucide-react';

import { guestReviewFeedbackTagLabel } from '@/features/guest/sd-form/lib/guestReviewFeedbackTags';

import type { GuestReviewMediaItem } from '@/features/reviews/lib/reviewMedia';

import { cn } from '@/lib/utils';

/** Longer bodies collapse so a list of reviews stays scannable. */
const CLAMP_AFTER_CHARS = 320;

export function ReviewBody({ text, className }: { text: string | null; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text?.trim()) return null;
  const clampable = text.length > CLAMP_AFTER_CHARS;

  return (
    <div className={className}>
      <p
        className={cn(
          /* Capped measure — full-width prose on a 1440px shell reads as ~130ch. */
          'text-foreground max-w-[68ch] whitespace-pre-line text-sm leading-relaxed',
          clampable && !expanded && 'line-clamp-4'
        )}
      >
        {text}
      </p>
      {clampable ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-primary hover:text-primary-strong relative mt-1 text-xs font-semibold before:absolute before:-inset-x-2 before:-inset-y-2.5 before:content-[''] sm:before:content-none"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

export function ReviewTagList({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tagId) => (
        <li
          key={tagId}
          className="border-border/70 bg-muted/50 text-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium"
        >
          {guestReviewFeedbackTagLabel(tagId)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Guest-attached photos / clips. Opens the stored file in a new tab rather than
 * pulling a lightbox into the list — hosts only need to look at it.
 */
export function ReviewMediaGrid({
  media,
  guestName,
  className,
}: {
  media: GuestReviewMediaItem[];
  guestName: string;
  className?: string;
}) {
  if (media.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {media.map((item, index) => (
        <li key={`${item.url}-${index}`}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${item.type === 'video' ? 'Video' : 'Photo'} ${index + 1} from ${guestName}`}
            className="border-border bg-muted/40 focus-visible:ring-ring relative block size-16 overflow-hidden rounded-lg border transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-20"
          >
            {item.type === 'video' ? (
              <span className="text-muted-foreground flex size-full items-center justify-center">
                <Play className="size-5" aria-hidden />
              </span>
            ) : (
              <img
                src={item.url}
                alt=""
                loading="lazy"
                decoding="async"
                width={80}
                height={80}
                className="size-full object-cover"
              />
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
