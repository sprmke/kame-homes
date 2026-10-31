import { describe, expect, it } from 'vitest';

import {
  gafRequestSendDisabledReason,
  gafRequestValidIdsReady,
} from '@/features/dashboard/bookings/lib/workflowEmailSendPrerequisites';
import { resolveWorkflowEmailTriggerAvailability } from '@/features/dashboard/bookings/lib/workflowEmailTriggerAvailability';

describe('gafRequestSendPrerequisites', () => {
  it('requires primary valid ID', () => {
    expect(
      gafRequestValidIdsReady({
        valid_id_url: null,
      })
    ).toBe(false);
    expect(gafRequestSendDisabledReason({ valid_id_url: null })).toMatch(/Valid ID/);
  });

  it('requires valid ID for each named additional guest', () => {
    const booking = {
      valid_id_url: 'https://example.com/id1.pdf',
      guest2_name: 'Jamie',
      guest2_valid_id_url: null,
    };
    expect(gafRequestValidIdsReady(booking)).toBe(false);
    expect(gafRequestSendDisabledReason(booking)).toMatch(/Guest 2/);
  });
});

describe('resolveWorkflowEmailTriggerAvailability gaf_request', () => {
  const base = {
    status: 'PENDING_DOCUMENTS',
    gaf_request_pdf_url: 'https://example.com/gaf.pdf',
    valid_id_url: 'https://example.com/id.pdf',
  };

  it('disables when a required valid ID is missing', () => {
    const result = resolveWorkflowEmailTriggerAvailability('gaf_request', {
      ...base,
      guest2_name: 'Alex',
      guest2_valid_id_url: null,
    });
    expect(result.enabled).toBe(false);
    expect(result.disabledReason).toMatch(/Guest 2/);
  });

  it('enables when GAF PDF and all valid IDs are on file', () => {
    const result = resolveWorkflowEmailTriggerAvailability('gaf_request', {
      ...base,
      guest2_name: 'Alex',
      guest2_valid_id_url: 'https://example.com/id2.pdf',
    });
    expect(result.enabled).toBe(true);
  });
});
