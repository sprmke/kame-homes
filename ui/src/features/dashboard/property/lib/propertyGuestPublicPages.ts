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

/**
 * Gallery section: `design` pages are editable, `share` links work with no booking,
 * and `booking` links need a valid booking or stay dates before a guest can open them.
 */
export type GuestPublicPageGroup = 'design' | 'share' | 'booking';

/** Copy opens a picker instead of copying the URL straight away. */
export type GuestPublicPageCopyPicker = 'sd-refund' | 'guest-review' | 'stay-dates';

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
  group: GuestPublicPageGroup;
  /** Host can open the Page Editor for this guest URL. */
  editable: boolean;
  /** Copy uses a different URL than open (e.g. booking-scoped pages). */
  copyPath?: string;
  /** Open in new tab uses `?embed=1` so hosts see a preview instead of a missing-booking error. */
  openUsesEmbed?: boolean;
  /** Host picks a booking or stay dates before the guest link is copied. */
  copyPicker?: GuestPublicPageCopyPicker;
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
      group: 'design',
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
      group: 'design',
      editable: true,
    },
    {
      id: 'listing',
      label: 'Property',
      description: 'Photos, rates, amenities, and reserve actions on your listing.',
      path: guestPropertyPath(propertySlug),
      icon: Home,
      group: 'design',
      editable: true,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      description: 'Guests pick check-in and check-out before the booking form.',
      path: guestCalendarPath(propertySlug),
      icon: Calendar,
      group: 'share',
      editable: false,
      copyPicker: 'stay-dates',
    },
    {
      id: 'form',
      label: 'Form',
      description: 'Multi-step booking request guests submit after choosing dates.',
      path: guestFormPath(propertySlug),
      icon: FileText,
      group: 'share',
      editable: false,
    },
    {
      id: 'pay-parking',
      label: 'Find parking',
      description: 'Stay-scoped marketplace search when a booking needs parking.',
      path: '/parkings',
      icon: Car,
      group: 'share',
      editable: false,
      openUsesEmbed: false,
    },
    {
      id: 'messages',
      label: 'Messages',
      description: 'Pre-stay chat between guests and your team.',
      path: guestMessagesPreviewPath(propertySlug),
      icon: MessageCircle,
      group: 'booking',
      editable: false,
      copyPicker: 'stay-dates',
    },
    {
      id: 'sd-form',
      label: 'SD Refund',
      description: 'Review, voucher, and refund details after checkout.',
      path: guestSdFormShellPath(propertySlug),
      icon: Wallet,
      group: 'booking',
      editable: false,
      openUsesEmbed: true,
      copyPicker: 'sd-refund',
    },
    {
      id: 'guest-review',
      label: 'Guest Review',
      description: 'Post-stay rating before the SD refund form.',
      path: guestReviewShellPath(propertySlug),
      icon: Star,
      group: 'booking',
      editable: false,
      openUsesEmbed: true,
      copyPicker: 'guest-review',
    },
  ];
}
