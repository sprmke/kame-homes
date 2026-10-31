import { Link } from 'react-router-dom';

import { ShieldCheck, CalendarCheck, HeartHandshake } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function LandingSocialProof() {
  return (
    <section className="border-border bg-background public-section-y border-t">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start gap-3">
              <div className="public-icon-well bg-primary/10 text-primary">
                <ShieldCheck className="size-[18px] md:size-5" aria-hidden />
              </div>
              <div>
                <p className="public-card-title text-foreground font-semibold">Verified listings</p>
                <p className="text-muted-foreground text-sm">
                  Every property is reviewed before it goes live.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="public-icon-well bg-primary/10 text-primary">
                <CalendarCheck className="size-[18px] md:size-5" aria-hidden />
              </div>
              <div>
                <p className="public-card-title text-foreground font-semibold">
                  Instant confirmation
                </p>
                <p className="text-muted-foreground text-sm">
                  Book and get your stay confirmed right away.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start gap-3">
              <div className="public-icon-well bg-primary/10 text-primary">
                <HeartHandshake className="size-[18px] md:size-5" aria-hidden />
              </div>
              <div>
                <p className="public-card-title text-foreground font-semibold">
                  Direct host support
                </p>
                <p className="text-muted-foreground text-sm">
                  Message your host any time before or during your stay.
                </p>
              </div>
            </div>

            <Button className="public-cta rounded-full" asChild>
              <Link to="/properties">Start exploring</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
