import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { Award } from 'lucide-react';

import { guestHostPath } from '@/features/guest/lib/guestPublicPaths';
import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

export type ListingHostInfo = {
  organizationName: string;
  organizationSlug: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  organizationLogoUrl: string | null;
  isSuperhost?: boolean;
  verifiedBadge?: boolean;
};

type Props = {
  host: ListingHostInfo;
  /** Animation delay for framer-motion (property page uses staggered reveals). */
  motionDelay?: number;
  className?: string;
  onContactHost?: () => void;
};

export function ListingHostCard({ host, motionDelay = 0.2, className, onContactHost }: Props) {
  const orgName = host.organizationName.trim() || 'Host';
  const hostAvatar = host.organizationLogoUrl || host.ownerAvatarUrl || null;
  const orgHref = host.organizationSlug ? guestHostPath(host.organizationSlug) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className={
        className ??
        'border-border bg-card @md:gap-4 @md:p-4 flex min-w-0 items-center gap-3 rounded-2xl border p-3'
      }
    >
      <div className="from-primary to-primary/80 relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br sm:h-12 sm:w-12">
        {hostAvatar ? (
          <Image
            src={hostAvatar}
            alt={orgName}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base font-bold text-white sm:text-lg">
            {orgName.charAt(0)}
          </div>
        )}
        {host.isSuperhost ? (
          <div className="bg-background absolute -bottom-0.5 -right-0.5 rounded-full p-0.5">
            <Award className="h-3.5 w-3.5 text-amber-500" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-foreground min-w-0 truncate text-sm font-semibold sm:text-base">
            Hosted by{' '}
            {orgHref ? (
              <Link to={orgHref} className="underline-offset-2 hover:underline">
                {orgName}
              </Link>
            ) : (
              orgName
            )}
          </p>
          {host.verifiedBadge ? <ListingRecommendedBadge /> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onContactHost}
        className="border-border text-foreground hover:bg-muted relative inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] md:h-10 md:text-sm"
      >
        Contact host
      </button>
    </motion.div>
  );
}
