import { Star } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { usePropertyReviews } from '@/features/reviews/hooks/usePropertyReviews';
import {
  defaultReviewsQuery,
  type ReceivedReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

/** Pickers only need the newest page of published reviews. */
const RECEIVED_PAGE_QUERY = defaultReviewsQuery('received');

export function ChatComposerReviewPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const propertyId = usePropertyIdParam();
  const query = usePropertyReviews('received', RECEIVED_PAGE_QUERY);
  const reviews = (query.data?.items ?? []).filter(
    (item): item is ReceivedReviewItem => 'starRating' in item
  );

  return (
    <ChatComposerContextPicker
      items={reviews}
      getItemId={(review) => review.id}
      searchHaystack={(review) =>
        `${review.guestName ?? ''} ${review.starRating} ${review.reviewText ?? ''}`
      }
      pageEntityId={pageEntityId}
      renderRow={(review, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={review.guestName?.trim() || 'Guest'}
          subtitle={`${review.starRating} stars`}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(review) =>
        onSelect({
          type: 'review',
          id: review.id,
          propertyId,
          label: review.guestName?.trim() || 'Guest review',
        })
      }
      searchPlaceholder="Review"
      searchAriaLabel="Search reviews"
      listAriaLabel="Reviews"
      emptyLabel="No reviews"
      isLoading={query.isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Star}
          label="Pin a review"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
