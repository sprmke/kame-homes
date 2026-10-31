import { describe, expect, it } from 'vitest';

import {
  bookingPipeline,
  canTransition,
  nextStep,
} from '@/features/dashboard/bookings/lib/workflow';

describe('workflow client mirror @smoke', () => {
  it('canTransition matches server happy path', () => {
    expect(canTransition('PENDING_REVIEW', 'PENDING_DOCUMENTS', { manual: false })).toBe(true);
    expect(canTransition('PENDING_DOCUMENTS', 'READY_FOR_CHECKIN', { manual: false })).toBe(true);
  });

  it('manual backward only when manual', () => {
    expect(canTransition('PENDING_DOCUMENTS', 'PENDING_REVIEW', { manual: false })).toBe(false);
    expect(canTransition('PENDING_DOCUMENTS', 'PENDING_REVIEW', { manual: true })).toBe(true);
  });

  it('bookingPipeline skips SD refund when deposit is zero', () => {
    const pipeline = bookingPipeline({ security_deposit: 0 }, 'PENDING_REVIEW');
    expect(pipeline).not.toContain('PENDING_SD_REFUND');
  });

  it('bookingPipeline D2 skips pending documents when requirements empty', () => {
    const pipeline = bookingPipeline({}, 'PENDING_REVIEW', []);
    expect(pipeline).not.toContain('PENDING_DOCUMENTS');
    expect(pipeline).toContain('READY_FOR_CHECKIN');
  });

  it('nextStep advances along pipeline', () => {
    expect(nextStep({ security_deposit: 1000 }, 'PENDING_REVIEW')).toBe('PENDING_DOCUMENTS');
    expect(nextStep({ security_deposit: 0 }, 'READY_FOR_CHECKOUT')).toBe('COMPLETED');
  });
});
