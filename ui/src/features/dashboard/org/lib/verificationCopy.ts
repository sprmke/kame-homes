/** Host-facing verification messaging (Get Verified modal + sidebar). Guest tooltip stays on ListingRecommendedBadge. */

export const VERIFICATION_TIER2_SUBTITLE =
  'Earn a Recommended badge guests notice on your host page.';

export const VERIFICATION_BENEFIT_BULLETS = [
  'Stand out on your host page',
  'Guests see a clear Recommended badge',
  'Access more host features in the app',
] as const;

export const VERIFICATION_SIDEBAR_SUBLABEL = 'Earn your Recommended badge.';

export const VERIFICATION_PREVIEW_CAPTION = 'Guests see this on your host page.';

export const VERIFICATION_PREVIEW_FALLBACK_NAME = 'Your host name';

export const VERIFICATION_REVIEW_TIMELINE = 'Review usually takes a few hours up to 3 days.';

export const VERIFICATION_TIER2_APPROVED = 'Recommended badge is live on your host page.';

export const VERIFICATION_TIER2_DOC_LABELS = {
  selfie: 'Selfie with valid ID',
  platformAdmin: 'Admin or host screenshot on another platform',
  legitimacyCheck: 'Legitimacy check proof',
  businessPermit: 'Business permit / BIR',
  /** @deprecated listing-scoped — see listingVerificationCopy */
  ownership: 'Additional Proof of Ownership/Authorization',
  /** @deprecated listing-scoped — see listingVerificationCopy */
  azurePmoConfirmation: 'Azure Property Management email confirmation',
} as const;

export const VERIFICATION_TIER2_DOC_HELP = {
  selfie:
    'Hold your valid ID next to your face. Use good light, no filters, and keep ID text readable.',
  platformAdmin:
    'Screenshot showing you as admin or host on Facebook, Instagram, Airbnb, or another listing platform.',
  legitimacyCheck: 'Any extra proof that backs your business legitimacy.',
  businessPermit: 'Business permit or BIR Certificate of Registration.',
  /** @deprecated listing-scoped */
  ownership:
    'e.g. Certificate of Title, Deed of Sale, Sublease Contract Agreement, Notarized Authorization (SPA), etc.',
  /** @deprecated listing-scoped */
  azurePmoConfirmation:
    'e.g. Property Management Email confirmation, approved GAF, gate pass, or building pass.',
} as const;
