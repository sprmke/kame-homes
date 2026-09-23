import { describe, expect, it } from 'vitest';

import { listingVerificationModalTitle, listingKindLabel, listingTier1ApprovedCopy, LISTING_VERIFICATION_TIER1_TITLE, LISTING_VERIFICATION_TIER2_TITLE, LISTING_VERIFICATION_TIER1_BENEFIT, LISTING_VERIFICATION_TIER2_BENEFIT, LISTING_VERIFICATION_REVIEW_TIMELINE, LISTING_VERIFICATION_TIER1_APPROVED_PROPERTY, LISTING_VERIFICATION_TIER1_APPROVED_PARKING, LISTING_VERIFICATION_TIER2_APPROVED, LISTING_VERIFICATION_BENEFIT_BULLETS, LISTING_VERIFICATION_DOC_LABELS, LISTING_VERIFICATION_DOC_HELP, LISTING_VERIFICATION_PREVIEW_CAPTION, LISTING_VERIFICATION_PREVIEW_FALLBACK, LISTING_VERIFICATION_SIDEBAR_SUBLABEL, LISTING_VERIFICATION_TIER2_PREREQ } from '@/features/dashboard/org/lib/listingVerificationCopy';

describe('listingVerificationModalTitle', () => {

  it('listingVerificationModalTitle is exported', () => {
    expect(typeof listingVerificationModalTitle).toBe('function');
  });

});

describe('listingKindLabel', () => {

  it('listingKindLabel is exported', () => {
    expect(typeof listingKindLabel).toBe('function');
  });

});

describe('listingTier1ApprovedCopy', () => {

  it('listingTier1ApprovedCopy is exported', () => {
    expect(typeof listingTier1ApprovedCopy).toBe('function');
  });

});

describe('LISTING_VERIFICATION_TIER1_TITLE', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER1_TITLE).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER2_TITLE', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER2_TITLE).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER1_BENEFIT', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER1_BENEFIT).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER2_BENEFIT', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER2_BENEFIT).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_REVIEW_TIMELINE', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_REVIEW_TIMELINE).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER1_APPROVED_PROPERTY', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER1_APPROVED_PROPERTY).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER1_APPROVED_PARKING', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER1_APPROVED_PARKING).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER2_APPROVED', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER2_APPROVED).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_BENEFIT_BULLETS', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_BENEFIT_BULLETS).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_DOC_LABELS', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_DOC_LABELS).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_DOC_HELP', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_DOC_HELP).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_PREVIEW_CAPTION', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_PREVIEW_CAPTION).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_PREVIEW_FALLBACK', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_PREVIEW_FALLBACK).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_SIDEBAR_SUBLABEL', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_SIDEBAR_SUBLABEL).toBeDefined();
  });
});

describe('LISTING_VERIFICATION_TIER2_PREREQ', () => {
  it('is defined', () => {
    expect(LISTING_VERIFICATION_TIER2_PREREQ).toBeDefined();
  });
});
