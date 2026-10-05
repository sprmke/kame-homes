import { Navigate, useParams } from 'react-router-dom';

import {
  DevelopmentHero,
  DevelopmentAmenities,
  DevelopmentAvailableSection,
} from '@/features/guest/marketing/developments/components';
import { usePublicDevelopment } from '@/features/guest/marketing/developments/hooks/usePublicDevelopment';
import { ListingLoadError } from '@/features/guest/marketing/shared/components/ListingLoadError';

import { DevelopmentDetailPageSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { buildDevelopmentJsonLd } from '@/lib/seo/seoMeta';
import { usePageMeta } from '@/lib/seo/usePageMeta';

export function DevelopmentDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const developmentResult = usePublicDevelopment(slug);
  const { data: development, isLoading, isError } = developmentResult;
  usePageTitle(publicPageTitle(development?.name ? `${development.name}` : 'Development'));
  const canonicalPath = `/developments/${development?.slug ?? slug}`;
  usePageMeta(
    {
      title: development?.name,
      description:
        development?.description ||
        (development
          ? `${development.name} in ${development.location}. Browse homes and parking.`
          : null),
      canonicalPath,
      image: development?.coverImage || null,
      jsonLd: development
        ? buildDevelopmentJsonLd({
            name: development.name,
            url: `${window.location.origin}${canonicalPath}`,
            description: development.description,
            image: development.coverImage || null,
            city: development.city,
          })
        : null,
    },
    Boolean(development)
  );

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <DevelopmentDetailPageSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-background min-h-screen pt-24">
        <ListingLoadError
          noun="this development"
          retrying={developmentResult.isFetching}
          onRetry={() => void developmentResult.refetch()}
        />
      </div>
    );
  }

  if (!development) {
    return <Navigate to="/developments" replace />;
  }

  return (
    <div className="bg-background min-h-screen">
      <DevelopmentHero development={development} />
      <DevelopmentAmenities development={development} />
      <DevelopmentAvailableSection development={development} />
    </div>
  );
}
