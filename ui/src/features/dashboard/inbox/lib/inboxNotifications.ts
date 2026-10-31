const INBOX_NOTIFY_PERMISSION_KEY = 'inbox-notify-permission-asked';

export function inboxNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function inboxNotificationsEnabled(): boolean {
  return inboxNotificationsSupported() && Notification.permission === 'granted';
}

/** One-time browser permission prompt (user gesture not required for Notification.requestPermission in some browsers). */
export async function ensureInboxNotificationPermission(): Promise<boolean> {
  if (!inboxNotificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const asked = localStorage.getItem(INBOX_NOTIFY_PERMISSION_KEY);
  if (asked === 'denied') return false;

  try {
    const result = await Notification.requestPermission();
    localStorage.setItem(INBOX_NOTIFY_PERMISSION_KEY, result);
    return result === 'granted';
  } catch {
    return false;
  }
}

export function notifyInboxNewMessage(opts: { title: string; body: string; tag?: string }): void {
  if (!inboxNotificationsEnabled()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag ?? 'inbox-message',
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore — Safari / blocked contexts
  }
}
