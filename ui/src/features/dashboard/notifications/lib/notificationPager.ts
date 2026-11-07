/**
 * Cursor stack for keyset-paginated lists (newest first): "Older" appends the
 * cursor the server just returned, "Newer" walks back through the same stack.
 * Only the page on screen is mounted, so the list never accumulates.
 */
export type NotificationPagerState = {
  cursors: (string | null)[];
  pageIndex: number;
};

export const INITIAL_NOTIFICATION_PAGER: NotificationPagerState = {
  cursors: [null],
  pageIndex: 0,
};

/** Cursor for the page on screen; null is the newest page. */
export function notificationPagerCursor(state: NotificationPagerState): string | null {
  return state.cursors[state.pageIndex] ?? null;
}

/** 1-based page number for the pager label. */
export function notificationPagerPageNumber(state: NotificationPagerState): number {
  return state.pageIndex + 1;
}

export function notificationPagerCanGoNewer(state: NotificationPagerState): boolean {
  return state.pageIndex > 0;
}

/** Moves one page older. No cursor means there is nothing older. */
export function notificationPagerGoOlder(
  state: NotificationPagerState,
  nextCursor: string | null | undefined
): NotificationPagerState {
  if (!nextCursor) return state;
  const cursors = state.cursors.slice(0, state.pageIndex + 1);
  cursors.push(nextCursor);
  return { cursors, pageIndex: state.pageIndex + 1 };
}

export function notificationPagerGoNewer(state: NotificationPagerState): NotificationPagerState {
  if (state.pageIndex === 0) return state;
  return { ...state, pageIndex: state.pageIndex - 1 };
}
