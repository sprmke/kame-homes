import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { proofContent } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';

const { statement, integrations } = proofContent;

export function ProofLine() {
  return (
    <section aria-label="How bookings are handled" className="border-border bg-card border-y">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="grid items-center gap-8 py-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12 lg:py-12">
          <p className="text-foreground max-w-xl text-lg font-medium leading-relaxed">
            {statement}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-3 lg:justify-end">
            {integrations.map((item) => (
              <li
                key={item.label}
                className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
              >
                <item.icon className="text-primary h-4 w-4" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
