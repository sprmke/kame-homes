import { describe, expect, it } from 'vitest';

import {
  parseBookingStage,
  getBookingStage,
  statusesForStage,
  effectiveStatusFilter,
  kanbanColumnForBooking,
  kanbanColumnForStatus,
  canKanbanDropTo,
  kanbanValidDropTargets,
  resolveKanbanDropTransition,
  kanbanDropIntentNestedKey,
  shortStatusLabel,
  countBookingsByStage,
  STAGE_META,
} from '@/features/dashboard/bookings/lib/bookingStages';

import { collectHelpCopyViolations } from '@/lib/help/helpCopyRules';

describe('parseBookingStage', () => {
  it('parseBookingStage is exported', () => {
    expect(typeof parseBookingStage).toBe('function');
  });
});

describe('getBookingStage', () => {
  it('getBookingStage is exported', () => {
    expect(typeof getBookingStage).toBe('function');
  });
});

describe('statusesForStage', () => {
  it('statusesForStage is exported', () => {
    expect(typeof statusesForStage).toBe('function');
  });
});

describe('effectiveStatusFilter', () => {
  it('effectiveStatusFilter is exported', () => {
    expect(typeof effectiveStatusFilter).toBe('function');
  });
});

describe('kanbanColumnForBooking', () => {
  it('kanbanColumnForBooking is exported', () => {
    expect(typeof kanbanColumnForBooking).toBe('function');
  });
});

describe('kanbanColumnForStatus', () => {
  it('kanbanColumnForStatus is exported', () => {
    expect(typeof kanbanColumnForStatus).toBe('function');
  });
});

describe('canKanbanDropTo', () => {
  it('canKanbanDropTo is exported', () => {
    expect(typeof canKanbanDropTo).toBe('function');
  });
});

describe('kanbanValidDropTargets', () => {
  it('kanbanValidDropTargets is exported', () => {
    expect(typeof kanbanValidDropTargets).toBe('function');
  });
});

describe('resolveKanbanDropTransition', () => {
  it('resolveKanbanDropTransition is exported', () => {
    expect(typeof resolveKanbanDropTransition).toBe('function');
  });
});

describe('kanbanDropIntentNestedKey', () => {
  it('kanbanDropIntentNestedKey is exported', () => {
    expect(typeof kanbanDropIntentNestedKey).toBe('function');
  });
});

describe('shortStatusLabel', () => {
  it('shortStatusLabel is exported', () => {
    expect(typeof shortStatusLabel).toBe('function');
  });
});

describe('countBookingsByStage', () => {
  it('countBookingsByStage is exported', () => {
    expect(typeof countBookingsByStage).toBe('function');
  });
});

describe('booking stage summary hints', () => {
  for (const [stage, meta] of Object.entries(STAGE_META)) {
    it(`${stage} hint follows the copy rules`, () => {
      expect(collectHelpCopyViolations(meta.hint, `STAGE_META.${stage}.hint`)).toEqual([]);
    });
  }

  it('uses a distinct hint per stage', () => {
    const hints = Object.values(STAGE_META).map((meta) => meta.hint);
    expect(new Set(hints).size).toBe(hints.length);
  });
});
