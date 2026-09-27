import { describe, expect, it } from 'vitest';

import {
  activityAbsoluteTime,
  activityRelativeTime,
  activitySummaryWithoutLeadingActor,
  changeSummary,
  formatActivityActorParts,
  formatChangeValue,
  friendlyActivitySummary,
  friendlyDeviceLabel,
  friendlyMetadataFacts,
  friendlySourceLabel,
  humanizeAction,
} from '@/features/dashboard/activity/lib/activityFormat';

describe('activityFormat', () => {
  it('humanizes action keys to a short verb phrase', () => {
    expect(humanizeAction('booking.status_changed')).toBe('Status Changed');
    expect(humanizeAction('billing.plan_downgraded')).toBe('Plan Downgraded');
  });

  it('formats change values', () => {
    expect(formatChangeValue(null)).toBe('-');
    expect(formatChangeValue(true)).toBe('Yes');
    expect(formatChangeValue({ a: 1 })).toBe('{"a":1}');
  });

  it('hides UUIDs in change values', () => {
    expect(formatChangeValue('277610f1-739e-4575-9e24-cc8cb8af0373')).toBe('-');
  });

  it('summarizes field changes', () => {
    expect(changeSummary([])).toBe('');
    expect(
      changeSummary([
        { field: 'status', from: 'a', to: 'b' },
        { field: 'guest_email', from: 'x', to: 'y' },
      ])
    ).toBe('status, guest email');
    expect(
      changeSummary([
        { field: 'a', from: 1, to: 2 },
        { field: 'b', from: 1, to: 2 },
        { field: 'c', from: 1, to: 2 },
        { field: 'd', from: 1, to: 2 },
      ])
    ).toContain('+1 more');
  });

  it('formats relative and absolute timestamps', () => {
    const iso = '2020-01-01T00:00:00.000Z';
    expect(activityRelativeTime(iso)).toMatch(/ago$/);
    expect(activityAbsoluteTime(iso).length).toBeGreaterThan(5);
  });

  it('prefers plan names and never shows plan UUIDs in summaries', () => {
    const uuid = '277610f1-739e-4575-9e24-cc8cb8af0373';
    expect(
      friendlyActivitySummary(`Alex downgraded the plan to ${uuid}`, {
        to_plan_name: 'Starter',
        to_plan: uuid,
      })
    ).toBe('Alex downgraded the plan to Starter');
    expect(friendlyActivitySummary(`Alex downgraded the plan to ${uuid}`)).toBe(
      'Alex downgraded the plan to a lower plan'
    );
    expect(friendlyActivitySummary(`Alex downgraded the plan to 277610f1…`)).toBe(
      'Alex downgraded the plan to a lower plan'
    );
  });

  it('strips a leading actor from the summary', () => {
    expect(
      activitySummaryWithoutLeadingActor(
        'sprmke.dev@gmail.com downgraded the plan to Starter',
        'sprmke.dev@gmail.com'
      )
    ).toBe('Downgraded the plan to Starter');
  });

  it('dedupes actor role labels', () => {
    expect(
      formatActivityActorParts({
        email: 'a@b.com',
        typeLabel: 'Owner',
        role: 'owner',
      })
    ).toEqual({ primary: 'a@b.com', secondary: 'Owner' });
  });

  it('humanizes source and device', () => {
    expect(friendlySourceLabel('dashboard')).toBe('Dashboard');
    expect(
      friendlyDeviceLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
      )
    ).toBe('Chrome on Mac');
  });

  it('exposes only host-safe metadata facts', () => {
    expect(
      friendlyMetadataFacts({
        to_plan: '277610f1-739e-4575-9e24-cc8cb8af0373',
        to_plan_name: 'Starter',
        related_event_ref: { table: 'org_subscription_events' },
      })
    ).toEqual([{ label: 'Plan', value: 'Starter' }]);
  });
});
