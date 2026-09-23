import { describe, expect, it } from 'vitest';

import { importCommitStatusForCheckIn } from '@/features/dashboard/bookings/lib/importCommitStatus';

describe('importCommitStatusForCheckIn', () => {

  it('importCommitStatusForCheckIn is exported', () => {
    expect(typeof importCommitStatusForCheckIn).toBe('function');
  });

});
