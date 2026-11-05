/**
 * After a host-triggered Channel sync toast already reports conflicts, suppress the
 * matching realtime `calendar_conflict` toast briefly so the UI does not double-notify.
 * Background cron syncs do not call this, so they still get one in-app toast.
 */

let suppressUntilMs = 0;

export function suppressCalendarConflictRealtimeToasts(ms = 8_000): void {
  suppressUntilMs = Date.now() + ms;
}

export function shouldShowCalendarConflictRealtimeToast(): boolean {
  return Date.now() > suppressUntilMs;
}
