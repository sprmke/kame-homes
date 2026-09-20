import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Play, Sparkles } from 'lucide-react';

import { HostCapabilityStrip } from '@/features/guest/marketing/for-hosts/components/HostCapabilityStrip';
import { HostClosingCta } from '@/features/guest/marketing/for-hosts/components/HostClosingCta';
import { HostDashboardTour } from '@/features/guest/marketing/for-hosts/components/HostDashboardTour';
import { HostHowItWorks } from '@/features/guest/marketing/for-hosts/components/HostHowItWorks';
import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';
import { AbstractBackground } from '@/features/guest/marketing/shared/components/AbstractBackground';

import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

export function ForHostsPage() {
  usePageTitle(publicPageTitle('For Hosts'));
  const reduceMotion = useReducedMotion();

  return (
    <>
      <section className="relative overflow-hidden">
        <AbstractBackground />

        <div className="relative z-10 pt-28 sm:pt-32 lg:pt-36">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <span className="border-border bg-muted/80 text-foreground/90 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm backdrop-blur-sm dark:border-white/20 dark:bg-white/10 dark:text-white/90">
                  <Sparkles className="text-primary h-4 w-4" aria-hidden />
                  For property hosts
                </span>
              </motion.div>

              <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-foreground mb-6 text-4xl font-black tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-7xl dark:text-white"
              >
                Run every stay
                <br />
                <span className="text-primary">from one dashboard</span>
              </motion.h1>

              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mx-auto mb-9 max-w-3xl text-base leading-relaxed sm:text-xl dark:text-white/70"
              >
                Bookings, guest messages, finance, marketing, and operations stay connected—so work
                keeps moving when you step away.
              </motion.p>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
              >
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 shadow-primary/30 min-h-[52px] rounded-full px-8 font-semibold text-white shadow-lg"
                  asChild
                >
                  <Link to="/for-hosts/login">
                    Start free
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="border-border bg-background/75 text-foreground hover:bg-muted min-h-[52px] rounded-full px-8 backdrop-blur-sm dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  onClick={() => scrollToSection('features', Boolean(reduceMotion))}
                >
                  <Play className="mr-2 h-4 w-4 fill-current" aria-hidden />
                  Watch product tour
                </Button>
              </motion.div>
            </div>
          </div>

          <HostDashboardTour />
        </div>
      </section>

      <HostCapabilityStrip />
      <HostHowItWorks />
      <HostClosingCta />
    </>
  );
}
