import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { HOST_TOUR_FEATURE_COUNT } from '@/features/guest/marketing/for-hosts/data/hostTourChapters';
import { Eyebrow } from '@/features/guest/marketing/for-hosts/preview/components/Eyebrow';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';

/**
 * The full narrated product tour (Remotion player, `variant="marketing"`). `id="features"` matches the marketing
 * nav anchor and the "full tour" links elsewhere on the page.
 */
export function VideoTourSection() {
  return (
    <section
      id="features"
      className="bg-muted/40 border-border scroll-mt-24 border-y py-16 sm:py-20 lg:py-24"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow>The full tour</Eyebrow>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Every feature, in under three minutes
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            A short narrated tour of all {HOST_TOUR_FEATURE_COUNT} features: bookings, pricing,
            finance, the guest inbox, AI photos and video, and AI mode. Jump to any part.
          </p>
        </Reveal>

        <Reveal y={24} className="mt-12">
          <HostDashboardTourPlayer variant="marketing" />
        </Reveal>
      </div>
    </section>
  );
}
