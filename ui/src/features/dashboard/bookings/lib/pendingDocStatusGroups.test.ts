import { describe, expect, it } from 'vitest';

import { DEFAULT_DOCUMENT_REQUIREMENTS } from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  buildPendingDocStatusGroups,
  freeOutboundNeedsManualSend,
} from '@/features/dashboard/bookings/lib/pendingDocStatusGroups';

const baseBooking = {
  id: 'b1',
  status: 'PENDING_DOCUMENTS',
  gaf_request_pdf_url: 'https://example.com/gaf.pdf',
  valid_id_url: 'https://example.com/id1.pdf',
  guest2_name: 'Alex',
  guest2_valid_id_url: null,
  has_pets: false,
} as const;

describe('buildPendingDocStatusGroups', () => {
  it('uses Sent Docs / Pending Docs on paid plans', () => {
    const groups = buildPendingDocStatusGroups({
      booking: { ...baseBooking } as never,
      requirements: DEFAULT_DOCUMENT_REQUIREMENTS,
      requirement: DEFAULT_DOCUMENT_REQUIREMENTS.find((r) => r.id === 'gaf'),
      sub: 'gaf',
      approvedUrl: null,
      approvalCompleted: false,
      automatedBookingFlow: true,
    });
    expect(groups[0]?.label).toBe('Sent Docs');
    expect(groups[1]?.label).toBe('Pending Docs');
  });

  it('uses To send / To Receive on Free with ready vs missing rows', () => {
    const groups = buildPendingDocStatusGroups({
      booking: { ...baseBooking } as never,
      requirements: DEFAULT_DOCUMENT_REQUIREMENTS,
      requirement: DEFAULT_DOCUMENT_REQUIREMENTS.find((r) => r.id === 'gaf'),
      sub: 'gaf',
      approvedUrl: null,
      approvalCompleted: false,
      automatedBookingFlow: false,
    });
    expect(groups[0]?.label).toBe('To send');
    expect(groups[0]?.summary).toBe('2 of 3 ready');
    expect(groups[1]?.label).toBe('To Receive');
    const guest2 = groups[0]?.rows.find((r) => r.label.includes('Guest 2'));
    expect(guest2?.status).toBe('missing');
    const primary = groups[0]?.rows.find((r) => r.label === 'Valid ID');
    expect(primary?.status).toBe('ready');
  });

  it('marks outbound package sent after manual GAF email', () => {
    const groups = buildPendingDocStatusGroups({
      booking: {
        ...baseBooking,
        guest2_valid_id_url: 'https://example.com/id2.pdf',
        workflow_email_manual_sent_at: { gaf_request: '2026-08-31T12:00:00.000Z' },
      } as never,
      requirements: DEFAULT_DOCUMENT_REQUIREMENTS,
      requirement: DEFAULT_DOCUMENT_REQUIREMENTS.find((r) => r.id === 'gaf'),
      sub: 'gaf',
      approvedUrl: null,
      approvalCompleted: false,
      automatedBookingFlow: false,
    });
    expect(groups[0]?.summary).toMatch(/^Sent/);
    expect(freeOutboundNeedsManualSend(groups)).toBe(false);
  });
});
