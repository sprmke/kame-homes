/**
 * Generic form placeholders — avoid real names, contact info, or property-specific values.
 *
 * Name, email, and phone inputs must use `fullName` / `email` / `phone` from here, never a
 * literal, so every form in the app shows the same example person. `formPlaceholders.test.ts`
 * enforces it. Organisation mailboxes (support, team, documents) keep the `@yourcompany.com`
 * pattern instead, because a personal address would be misleading for a shared inbox.
 */
export const FORM_PLACEHOLDERS = {
  fullName: 'Ex. Juan Dela Cruz',
  towerAndUnit: 'Ex. Monaco 1234',
  phone: '0917 123 4567',
  email: 'juan.delacruz@gmail.com',
  residenceName: 'Ex. Sunset Residences',
  orgDisplayName: 'My organization',
  websiteUrl: 'https://example.com',
  facebookPage: 'https://facebook.com/your-page',
  airbnbListing: 'https://airbnb.com/rooms/your-listing',
  instagramProfile: 'https://instagram.com/your-page',
  tiktokProfile: 'https://tiktok.com/@your-page',
  unitNumber: '2604',
  bookingRate: '2500',
  downPayment: '1500',
  securityDeposit: '1500',
  parkingRate: '500',
  bankAccountNumber: '1234567890',
  orgSupportEmail: 'support@yourcompany.com',
  orgDocumentsApproverEmail: 'documents@yourcompany.com',
  orgTeamEmail: 'team@yourcompany.com',
  orgParkingOwners: 'owner1@example.com, owner2@example.com',
  orgSdRefundLeadHours: '3',
  orgStaleCheckoutEmailCutoffDays: '30',
  orgDefaultParkingRate: '400',
} as const;
