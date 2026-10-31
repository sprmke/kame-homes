export const PROPERTY_AUTOMATION_TOGGLE_KEYS = [
  'emailNewBookingRequest',
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailParkingBroadcast',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
] as const;

export type PropertyAutomationToggleKey = (typeof PROPERTY_AUTOMATION_TOGGLE_KEYS)[number];

export type PropertyAutomationToggles = Record<PropertyAutomationToggleKey, boolean>;

export const DEFAULT_PROPERTY_AUTOMATION_TOGGLES: PropertyAutomationToggles = {
  emailNewBookingRequest: true,
  emailGafRequest: true,
  emailBookingAcknowledgement: true,
  emailPetRequest: true,
  emailParkingBroadcast: true,
  emailReadyForCheckin: true,
  emailSdRefundCheckout: true,
};

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
    id: 'team-email',
    title: 'Team',
    items: [
      {
        key: 'emailNewBookingRequest',
        label: 'New booking alert',
        recipient: 'Property email',
        trigger: 'Guest submits the booking form.',
      },
    ],
  },
  {
    id: 'management-email',
    title: 'Management',
    items: [
      {
        key: 'emailGafRequest',
        label: 'GAF request',
        recipient: 'PMO email',
        trigger:
          'Admin proceeds to pending documents status which includes GAF request and guest ID files.',
      },
      {
        key: 'emailPetRequest',
        label: 'Pet request',
        recipient: 'PMO email',
        trigger: 'Admin proceeds to pending documents status which includes pet request.',
      },
    ],
  },
  {
    id: 'guest-email',
    title: 'Guest',
    items: [
      {
        key: 'emailBookingAcknowledgement',
        label: 'Booking acknowledgement',
        recipient: 'Guest email',
        trigger: 'Admin reviwed and approved the booking request.',
      },
      {
        key: 'emailReadyForCheckin',
        label: 'Ready for check-in',
        recipient: 'Guest email',
        trigger:
          'All required documents are approved and the booking moves to ready for check-in status.',
      },
      {
        key: 'emailSdRefundCheckout',
        label: 'Check-out & SD refund form',
        recipient: 'Guest email',
        trigger: 'Before check-out and when the stay advances to ready for check-out status.',
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
