import { describe, expect, it } from 'vitest';

import {
  eligibleManualWorkflowEmailKinds,
  sortManualWorkflowEmailTriggerKinds,
} from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';

describe('eligibleManualWorkflowEmailKinds', () => {
  it('returns empty on terminal statuses', () => {
    expect(eligibleManualWorkflowEmailKinds({ status: 'COMPLETED' })).toEqual([]);
    expect(eligibleManualWorkflowEmailKinds({ status: 'CANCELLED' })).toEqual([]);
  });

  it('includes GAF and ack on PENDING_DOCUMENTS when applicable', () => {
    const kinds = eligibleManualWorkflowEmailKinds({
      status: 'PENDING_DOCUMENTS',
      gaf_request_pdf_url: 'https://example.com/gaf.pdf',
      need_parking: true,
    });
    expect(kinds).toContain('gaf_request');
    expect(kinds).toContain('booking_acknowledgement');
  });

  it('includes pet when has_pets and pet PDF present', () => {
    const kinds = eligibleManualWorkflowEmailKinds({
      status: 'PENDING_DOCUMENTS',
      has_pets: true,
      pet_request_pdf_url: 'https://example.com/pet.pdf',
      gaf_request_pdf_url: 'https://example.com/gaf.pdf',
    });
    expect(kinds).toContain('pet_request');
  });

  it('omits GAF when request PDF missing', () => {
    const kinds = eligibleManualWorkflowEmailKinds({
      status: 'PENDING_DOCUMENTS',
      gaf_request_pdf_url: null,
    });
    expect(kinds).not.toContain('gaf_request');
  });

  it('includes ready and SD on READY_FOR_CHECKIN', () => {
    const kinds = eligibleManualWorkflowEmailKinds({
      status: 'READY_FOR_CHECKIN',
      gaf_request_pdf_url: 'https://example.com/gaf.pdf',
    });
    expect(kinds).toContain('ready_for_checkin');
    expect(kinds).toContain('sd_refund_form_request');
  });

  it('includes only SD resend on READY_FOR_CHECKOUT', () => {
    const kinds = eligibleManualWorkflowEmailKinds({
      status: 'READY_FOR_CHECKOUT',
      gaf_request_pdf_url: 'https://example.com/gaf.pdf',
    });
    expect(kinds).toEqual(expect.arrayContaining(['sd_refund_form_request']));
    expect(kinds).not.toContain('ready_for_checkin');
  });
});

describe('sortManualWorkflowEmailTriggerKinds', () => {
  it('puts booking acknowledgement first', () => {
    expect(
      sortManualWorkflowEmailTriggerKinds([
        'gaf_request',
        'ready_for_checkin',
        'booking_acknowledgement',
        'pet_request',
      ])
    ).toEqual(['booking_acknowledgement', 'gaf_request', 'pet_request', 'ready_for_checkin']);
  });
});
