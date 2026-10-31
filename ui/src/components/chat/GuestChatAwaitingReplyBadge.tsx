import { softBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export function GuestChatAwaitingReplyBadge({ className }: { className?: string }) {
  return <span className={cn(softBadgeClasses('pending'), className)}>Awaiting reply</span>;
}
