import { Award } from 'lucide-react';

import { HostPublicSocialLinks } from '@/features/guest/marketing/hosts/components/HostPublicSocialLinks';
import type { PublicHostProfile } from '@/features/guest/marketing/properties/hooks/usePublicHost';
import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  host: PublicHostProfile;
  className?: string;
};

export function HostPublicHero({ host, className }: Props) {
  const avatar = host.ownerAvatarUrl || host.logoUrl;
  const logo = host.logoUrl;
  const hasSocials = Object.values(host.socialLinks).some(Boolean);

  return (
    <header className={cn('relative', className)}>
      <div
        className="from-primary/[0.08] via-primary/[0.03] pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b to-transparent sm:h-72"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-8 lg:gap-10">
          <div className="relative shrink-0">
            <div
              className="absolute rounded-full bg-gradient-to-br from-[hsl(var(--gradient-primary-from)/0.35)] to-[hsl(var(--gradient-primary-to)/0.15)]"
              aria-hidden
            />
            <div className="bg-muted relative h-20 w-20 overflow-hidden rounded-full shadow-md sm:h-32 sm:w-32 lg:h-36 lg:w-36">
              {logo ? (
                <Image
                  src={logo}
                  alt={host.name}
                  width={144}
                  height={144}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="from-primary to-primary/80 flex h-full w-full items-center justify-center bg-gradient-to-br text-3xl font-bold text-white sm:text-4xl">
                  {host.name.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3 text-center sm:space-y-5 sm:pt-1 sm:text-left">
            <div className="space-y-2 sm:space-y-2.5">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-3">
                <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl lg:text-[2rem] lg:leading-tight">
                  {host.name}
                </h1>
                {host.isSuperhost ? (
                  <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                    <Award className="size-3.5" aria-hidden />
                    Superhost
                  </Badge>
                ) : null}
                {host.verifiedBadge ? <ListingRecommendedBadge size="md" /> : null}
              </div>

              {host.isSuperhost ? (
                <p className="text-muted-foreground text-xs sm:text-[13px]">Superhost</p>
              ) : host.verifiedBadge ? (
                <p className="text-muted-foreground text-xs sm:text-[13px]">Recommended host</p>
              ) : null}

              <div className="flex items-center justify-center gap-2.5 sm:justify-start">
                <div className="from-primary to-primary/80 relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br sm:h-9 sm:w-9">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={host.ownerName}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                      {host.ownerName.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-sm sm:text-[15px]">
                  Hosted by <span className="text-foreground font-medium">{host.ownerName}</span>
                </p>
              </div>

              {host.tagline ? (
                <p className="text-primary mx-auto max-w-xl text-sm font-medium leading-snug sm:mx-0 sm:text-base">
                  {host.tagline}
                </p>
              ) : null}
            </div>

            {host.description ? (
              <p className="text-muted-foreground text-[13px] leading-snug sm:mx-0 sm:text-sm sm:text-[15px] sm:leading-relaxed">
                {host.description}
              </p>
            ) : null}

            {hasSocials ? (
              <HostPublicSocialLinks
                links={host.socialLinks}
                className="justify-center sm:justify-start"
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
