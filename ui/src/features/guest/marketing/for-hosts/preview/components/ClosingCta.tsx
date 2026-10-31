import { Link } from 'react-router-dom';

import { ArrowRight } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { closingContent } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';

import { Button } from '@/components/ui/button';

const { eyebrow, title, body, primaryCta, secondaryCta, trustLine } = closingContent;

export function ClosingCta() {
  return (
    <section className="bg-primary-strong text-primary-foreground">
      <div className="container mx-auto px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <Reveal className="max-w-2xl">
          <p className="text-primary-foreground/70 flex items-center gap-3 text-sm font-semibold">
            <span aria-hidden className="bg-primary-foreground/60 h-px w-6" />
            {eyebrow}
          </p>
          <h2 className="mt-4 text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
            {title}
          </h2>
          <p className="text-primary-foreground/85 mt-5 max-w-xl text-lg leading-relaxed">{body}</p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="text-primary min-h-[52px] rounded-full bg-white px-8 text-base font-semibold hover:bg-white/90"
            >
              <Link to={primaryCta.to}>
                {primaryCta.label}
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-[52px] rounded-full border-white/40 bg-transparent px-8 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
            </Button>
          </div>

          <p className="text-primary-foreground/65 mt-7 text-[13px]">{trustLine}</p>
        </Reveal>
      </div>
    </section>
  );
}
