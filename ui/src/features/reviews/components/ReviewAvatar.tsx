import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** First letters of the first and last word, e.g. "Maria Santos" → "MS". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Guest anchor for review list cards. Decorative — the name sits next to it. */
export function ReviewAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar aria-hidden className={cn('size-9', className)}>
      <AvatarFallback className="text-xs font-semibold">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
