import { describe, expect, it } from 'vitest';

import { resolveAiGeneratedDesignDocument, resolveAiGeneratedDesignDocumentsForAllFormats } from '@/features/dashboard/marketing/lib/polotno/polotnoAiCampaignDocuments';

describe('resolveAiGeneratedDesignDocument', () => {

  it('resolveAiGeneratedDesignDocument is exported', () => {
    expect(typeof resolveAiGeneratedDesignDocument).toBe('function');
  });

});

describe('resolveAiGeneratedDesignDocumentsForAllFormats', () => {

  it('resolveAiGeneratedDesignDocumentsForAllFormats is exported', () => {
    expect(typeof resolveAiGeneratedDesignDocumentsForAllFormats).toBe('function');
  });

});
