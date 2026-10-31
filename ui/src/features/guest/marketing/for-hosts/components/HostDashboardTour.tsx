import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';

export function HostDashboardTour() {
  return (
    <div id="features" className="scroll-mt-24 pb-10 pt-8 md:pb-20 md:pt-16 lg:pb-24 lg:pt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-6 max-w-3xl text-center md:mb-12">
          <p className="public-eyebrow text-primary mb-2.5 md:mb-3">
            One workspace, every moving part
          </p>
          <h2 className="text-foreground text-2xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            Watch a booking become a business
          </h2>
        </div>

        <HostDashboardTourPlayer variant="marketing" />
      </div>
    </div>
  );
}
