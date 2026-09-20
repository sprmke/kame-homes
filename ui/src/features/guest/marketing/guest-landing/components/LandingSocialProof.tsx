import { Link } from 'react-router-dom';

import { ShieldCheck, CalendarCheck, HeartHandshake } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function LandingSocialProof() {
  return (
    <section className="border-border bg-background border-t py-14 lg:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-foreground font-semibold">Verified listings</p>
                <p className="text-muted-foreground text-sm">
                  Every property is reviewed before it goes live.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl">
                <CalendarCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-foreground font-semibold">Instant confirmation</p>
                <p className="text-muted-foreground text-sm">
                  Book and get your stay confirmed right away.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl">
                <HeartHandshake className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-foreground font-semibold">Direct host support</p>
                <p className="text-muted-foreground text-sm">
                  Message your host any time before or during your stay.
                </p>
              </div>
            </div>

            <Button className="min-h-[44px] rounded-full px-6" asChild>
              <Link to="/properties">Start exploring</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
