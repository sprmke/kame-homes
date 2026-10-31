import {
  BookOpen,
  Calendar,
  Car,
  FileText,
  Home,
  MessageCircle,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';

import {
  guestCalendarPath,
  guestFormPath,
  guestMessagesPreviewPath,
  guestPropertyPath,
  guestReviewShellPath,
  guestSdFormShellPath,
  guestShowcasePath,
  guestStayGuidePreviewPath,
} from '@/features/guest/lib/guestPublicPaths';

import type { LucideIcon } from 'lucide-react';

export type PropertyGuestPublicPage = {
  id:
    | 'listing'
    | 'calendar'
    | 'form'
    | 'messages'
    | 'stay-guide'
    | 'showcase'
    | 'sd-form'
    | 'guest-review'
    | 'pay-parking';
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  /** Host can open the Page Editor for this guest URL. */
  editable: boolean;
  /** Copy uses a different URL than open (e.g. booking-scoped pages). */
  copyPath?: string;
  /** Open in new tab uses `?embed=1` so hosts see a preview instead of a missing-booking error. */
  openUsesEmbed?: boolean;
};

/** Guest-facing property URLs hosts can open from the dashboard. */
export function buildPropertyGuestPublicPages(
  propertySlug: string,
  propertyId: string
): PropertyGuestPublicPage[] {
  return [
    {
      id: 'showcase',
      label: 'Showcase',
      description: 'Shareable animated landing page for this property.',
      path: guestShowcasePath(propertySlug),
      icon: Sparkles,
      editable: true,
      // Live public URL (no embed) so Free/Starter hit the plan-lock overlay; gallery iframe still uses embed preview.
      openUsesEmbed: false,
    },
    {
      id: 'stay-guide',
      label: 'Stay Guide',
      description: 'House rules and check-in info sent at ready-for-checkin.',
      path: guestStayGuidePreviewPath(propertySlug, propertyId),
      icon: BookOpen,
      editable: true,
    },
    {
      id: 'listing',
      label: 'Property',
      description: 'Photos, rates, amenities, and reserve actions on your listing.',
      path: guestPropertyPath(propertySlug),
      icon: Home,
      editable: true,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      description: 'Guests pick check-in and check-out before the booking form.',
      path: guestCalendarPath(propertySlug),
      icon: Calendar,
      editable: false,
    },
    {
      id: 'form',
      label: 'Form',
      description: 'Multi-step booking request guests submit after choosing dates.',
      path: guestFormPath(propertySlug),
      icon: FileText,
      editable: false,
    },
    {
      id: 'messages',
      label: 'Messages',
      description: 'Pre-stay chat between guests and your team.',
      path: guestMessagesPreviewPath(propertySlug),
      icon: MessageCircle,
      editable: false,
    },
    {
      id: 'sd-form',
      label: 'SD Refund',
      description: 'Review, voucher, and refund details after checkout.',
      path: guestSdFormShellPath(propertySlug),
      icon: Wallet,
      editable: false,
      openUsesEmbed: true,
    },
    {
      id: 'guest-review',
      label: 'Guest Review',
      description: 'Post-stay rating before the SD refund form.',
      path: guestReviewShellPath(propertySlug),
      icon: Star,
      editable: false,
      openUsesEmbed: true,
    },
    {
      id: 'pay-parking',
      label: 'Find parking',
      description: 'Stay-scoped marketplace search when a booking needs parking.',
      path: '/parkings',
      copyPath: '/parkings?linkStay=',
      icon: Car,
      editable: false,
      openUsesEmbed: false,
    },
  ];
}
