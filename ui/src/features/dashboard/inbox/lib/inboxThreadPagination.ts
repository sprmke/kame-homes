import { INBOX_THREAD_PAGE_SIZE } from '@/features/dashboard/inbox/lib/inboxApi';
import type {
  ThreadPlatformFilter,
  ThreadStatusFilter,
} from '@/features/dashboard/inbox/types/inbox';

export type InboxThreadListFilters = {
  status: ThreadStatusFilter;
  platform: ThreadPlatformFilter;
  search: string;
};

/** Meta scroll-sync only applies to the unfiltered “all threads” list. */
export function inboxFiltersBlockMetaScrollSync(filters: InboxThreadListFilters): boolean {
  if (filters.search.trim()) return true;
  if (filters.status !== 'all') return true;
  if (filters.platform !== 'all') return true;
  return false;
}

export function inboxPageExhaustedInDb(conversationCount: number): boolean {
  return conversationCount < INBOX_THREAD_PAGE_SIZE;
}
