export const PROPERTY_AUTOMATION_TOGGLE_KEYS = [
  'emailNewBookingRequest',
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
  'emailReviewRequest',
  'emailReviewReminder',
] as const;

export type PropertyAutomationToggleKey = (typeof PROPERTY_AUTOMATION_TOGGLE_KEYS)[number];

export type PropertyAutomationToggles = Record<PropertyAutomationToggleKey, boolean>;

export const DEFAULT_PROPERTY_AUTOMATION_TOGGLES: PropertyAutomationToggles = {
  emailNewBookingRequest: true,
  emailGafRequest: true,
  emailBookingAcknowledgement: true,
  emailPetRequest: true,
  emailReadyForCheckin: true,
  emailSdRefundCheckout: true,
  emailReviewRequest: true,
  emailReviewReminder: true,
};

/** Mirrors `_shared/propertyAutomationToggles.ts#PLAN_GATED_AUTOMATION_TOGGLE_KEYS`. */
export const PLAN_GATED_AUTOMATION_TOGGLE_KEYS: ReadonlySet<PropertyAutomationToggleKey> = new Set([
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
]);

export type PropertyAutomationToggleGroup = {
  id: string;
  title: string;
  items: Array<{
    key: PropertyAutomationToggleKey;
    label: string;
    recipient: string;
    trigger: string;
  }>;
};

export const PROPERTY_AUTOMATION_TOGGLE_GROUPS: PropertyAutomationToggleGroup[] = [
  {
    id: 'team',
    title: 'Your team',
    items: [
      {
        key: 'emailNewBookingRequest',
        label: 'New booking alert',
        recipient: 'Team email',
        trigger: 'When a guest submits the booking form.',
      },
    ],
  },
  {
    id: 'building-admin',
    title: 'Building admin',
    items: [
      {
        key: 'emailGafRequest',
        label: 'GAF request',
        recipient: 'Building admin email',
        trigger: 'When you approve a booking that needs building documents.',
      },
      {
        key: 'emailPetRequest',
        label: 'Pet request',
        recipient: 'Building admin email',
        trigger: 'When you approve a booking that includes a pet.',
      },
    ],
  },
  {
    id: 'guest',
    title: 'Guest',
    items: [
      {
        key: 'emailBookingAcknowledgement',
        label: 'Booking acknowledgement',
        recipient: 'Guest email',
        trigger: 'When you approve the booking.',
      },
      {
        key: 'emailReadyForCheckin',
        label: 'Ready for check-in',
        recipient: 'Guest email',
        trigger: 'When all required documents are approved.',
      },
      {
        key: 'emailSdRefundCheckout',
        label: 'Check-out and deposit refund',
        recipient: 'Guest email',
        trigger: 'Before check-out, using the timing above.',
      },
    ],
  },
  {
    id: 'guest-reviews',
    title: 'Guest reviews',
    items: [
      {
        key: 'emailReviewRequest',
        label: 'Review request',
        recipient: 'Guest email',
        trigger: 'After check-out when the review window opens.',
      },
      {
        key: 'emailReviewReminder',
        label: 'Review reminder',
        recipient: 'Guest email',
        trigger: 'If the guest has not reviewed before the window closes.',
      },
    ],
  },
];

export function automationTogglesEqual(
  a: PropertyAutomationToggles,
  b: PropertyAutomationToggles
): boolean {
  return PROPERTY_AUTOMATION_TOGGLE_KEYS.every((key) => a[key] === b[key]);
}

export const SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS = 168;
