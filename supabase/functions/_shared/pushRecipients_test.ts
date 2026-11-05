/**
 * Pure recipient/RBAC logic for the push fan-out.
 *
 * The DB-backed parts (`resolveNotificationRecipientUserIds`) need a Supabase
 * client, so they are covered by the handler tests instead; these are the rules
 * that decide *whether* a scoped team member should receive a push at all.
 */
import { assertEquals } from 'jsr:@std/assert@1';

import {
  memberCanReceiveNotification,
  permissionForNotificationType,
} from './pushRecipients.ts';

Deno.test('permissionForNotificationType maps each area to its section leaf', () => {
  assertEquals(permissionForNotificationType('inbox_new_message'), 'inbox:view');
  assertEquals(permissionForNotificationType('booking_pending_review'), 'bookings:view');
  assertEquals(permissionForNotificationType('booking_ready_for_checkin'), 'bookings:view');
  assertEquals(permissionForNotificationType('review_received'), 'reviews:view');
  assertEquals(permissionForNotificationType('calendar_conflict'), 'bookings:view');
  assertEquals(permissionForNotificationType('calendar_sync_failing'), 'pricing:view');
  assertEquals(permissionForNotificationType('smart_pricing_updated'), 'pricing:view');
  assertEquals(permissionForNotificationType('analytics_review_updated'), 'analytics:view');
  assertEquals(permissionForNotificationType('booking_sd_refund_due'), 'bookings:view');
  assertEquals(permissionForNotificationType('maintenance_guest_reported'), 'maintenance:view');
});

Deno.test('permissionForNotificationType returns null for operational types', () => {
  assertEquals(permissionForNotificationType('platform_announcement'), null);
  assertEquals(permissionForNotificationType('guest_account'), null);
});

Deno.test('a member needs notifications:view before anything else', () => {
  assertEquals(memberCanReceiveNotification([], 'inbox_new_message'), false);
  assertEquals(memberCanReceiveNotification(['bookings:view'], 'inbox_new_message'), false);
  assertEquals(
    memberCanReceiveNotification(['notifications:view', 'inbox:view'], 'inbox_new_message'),
    true
  );
});

Deno.test('a member without the section leaf is skipped', () => {
  assertEquals(
    memberCanReceiveNotification(['notifications:view', 'bookings:view'], 'inbox_new_message'),
    false
  );
  // A booking-shaped notification links to the booking, so it needs bookings:view
  // even when the *content* is money (SD refund due).
  assertEquals(
    memberCanReceiveNotification(['notifications:view', 'finance:view'], 'booking_sd_refund_due'),
    false
  );
  assertEquals(
    memberCanReceiveNotification(['notifications:view', 'bookings:view'], 'booking_sd_refund_due'),
    true
  );
});

Deno.test('legacy permission ids still expand', () => {
  // `MANAGER`-era ids are expanded by `legacyPermissionExpansion`; a legacy member
  // must keep receiving pushes after the granular split.
  const legacyManager = ['bookings:view', 'notifications:view', 'inbox:view'];
  assertEquals(memberCanReceiveNotification(legacyManager, 'inbox_new_message'), true);
});

Deno.test('malformed permission payloads never grant access', () => {
  assertEquals(memberCanReceiveNotification(null, 'inbox_new_message'), false);
  assertEquals(memberCanReceiveNotification(undefined, 'inbox_new_message'), false);
  assertEquals(memberCanReceiveNotification('inbox:view', 'inbox_new_message'), false);
  assertEquals(memberCanReceiveNotification([1, 2, 3], 'inbox_new_message'), false);
});
