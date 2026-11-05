import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { V3SectionHeading } from '@/features/guest/marketing/for-hosts/v3/components/V3SectionHeading';
import { v3Capabilities } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

/**
 * The rest of the product in one hairline grid: icon, name, one short line. Keeps every shipped
 * capability on the page without another wall of feature cards. Twelve items fill the 2, 3,
 * and 4 column layouts evenly; keep the count a multiple of 12 so no row is left ragged.
 */
export function V3CapabilityGrid() {
  return (
    <section className="py-20 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <V3SectionHeading eyebrow={v3Capabilities.eyebrow} title={v3Capabilities.title} />

        <Reveal
          as="div"
          delay={0.08}
          className="border-border bg-border mt-10 overflow-hidden rounded-[1.5rem] border sm:mt-12"
        >
          <ul className="grid grid-cols-2 gap-px md:grid-cols-3 lg:grid-cols-4">
            {v3Capabilities.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="bg-card group p-4 sm:p-6">
                  <Icon
                    className="text-primary h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <p className="text-foreground mt-4 text-sm font-bold sm:text-base">
                    {item.label}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                    {item.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
