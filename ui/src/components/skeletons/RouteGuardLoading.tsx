import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { useRouteSkeleton } from '@/components/skeletons/RouteSkeleton';

/** In-shell guard loading: route skeleton when wired, else spinner. */
export function RouteGuardLoading({ fullScreen = false }: { fullScreen?: boolean } = {}) {
  const skeleton = useRouteSkeleton();
  if (skeleton) {
    return <>{skeleton}</>;
  }
  return <RouteGuardSkeleton fullScreen={fullScreen} />;
}
