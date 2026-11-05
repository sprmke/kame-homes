import {
  guestReviewFeedbackPrompt,
  guestReviewTagsForRating,
  MAX_GUEST_REVIEW_FEEDBACK_TAGS,
} from '@/features/guest/sd-form/lib/guestReviewFeedbackTags';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface GuestReviewFeedbackPillsProps {
  starRating: number;
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function GuestReviewFeedbackPills({
  starRating,
  selectedTagIds,
  onChange,
  disabled = false,
}: GuestReviewFeedbackPillsProps) {
  if (starRating < 1) return null;

  const options = guestReviewTagsForRating(starRating);
  const prompt = guestReviewFeedbackPrompt(starRating);

  const toggleTag = (tagId: string) => {
    if (disabled) return;
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
      return;
    }
    if (selectedTagIds.length >= MAX_GUEST_REVIEW_FEEDBACK_TAGS) return;
    onChange([...selectedTagIds, tagId]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{prompt}</Label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={prompt}>
        {options.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          const atCap = !selected && selectedTagIds.length >= MAX_GUEST_REVIEW_FEEDBACK_TAGS;
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled || atCap}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                'public-chip rounded-full border font-medium transition-colors',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-45',
                selected
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-card text-foreground hover:border-primary/35 hover:bg-muted/40'
              )}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
