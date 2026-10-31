import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type AccountAvatarProps = {
  avatarUrl: string | null;
  initials: string;
  className?: string;
  fallbackClassName?: string;
};

export function AccountAvatar({
  avatarUrl,
  initials,
  className,
  fallbackClassName,
}: AccountAvatarProps) {
  return (
    <Avatar className={cn('shrink-0', className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback
        className={cn('gradient-primary text-primary-foreground font-bold', fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
