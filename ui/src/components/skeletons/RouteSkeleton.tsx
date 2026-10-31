import { createContext, Suspense, useContext, type ReactNode } from 'react';

const RouteSkeletonContext = createContext<ReactNode | null>(null);

export function RouteSkeletonProvider({
  skeleton,
  children,
}: {
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return <RouteSkeletonContext.Provider value={skeleton}>{children}</RouteSkeletonContext.Provider>;
}

export function useRouteSkeleton(): ReactNode | null {
  return useContext(RouteSkeletonContext);
}

/** Per-route lazy chunk + permission-guard loading shape (eager skeleton only). */
export function RouteSkeletonBoundary({
  skeleton,
  children,
}: {
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <RouteSkeletonProvider skeleton={skeleton}>
      <Suspense fallback={skeleton}>{children}</Suspense>
    </RouteSkeletonProvider>
  );
}
