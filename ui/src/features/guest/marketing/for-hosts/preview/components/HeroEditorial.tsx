import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';

import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';
import { Eyebrow } from '@/features/guest/marketing/for-hosts/preview/components/Eyebrow';
import { HeroPipelineBoard } from '@/features/guest/marketing/for-hosts/preview/components/HeroPipelineBoard';
import { heroContent } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';

import { Button } from '@/components/ui/button';

const { eyebrow, headline, lead, primaryCta, secondaryCta, trustLine } = heroContent;

export function HeroEditorial() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-36">
      {/* Single, static, barely-there wash — no canvas, no grid. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 78% 8%, hsl(var(--primary) / 0.08), transparent 60%)',
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Eyebrow>{eyebrow}</Eyebrow>
            </motion.div>

            <h1 className="text-foreground mt-6 text-[clamp(2.5rem,5.6vw,3.9rem)] font-extrabold leading-[1.06] tracking-[-0.03em]">
              {headline.map((line, index) => {
                const isLast = index === headline.length - 1;
                const words = line.split(' ');
                const leadWords = words.slice(0, -1).join(' ');
                const lastWord = words[words.length - 1];
                return (
                  <span key={line} className="block overflow-hidden pb-[0.06em]">
                    <motion.span
                      className="block"
                      initial={reduceMotion ? false : { y: '115%' }}
                      animate={{ y: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.7,
                        delay: reduceMotion ? 0 : 0.1 + index * 0.09,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {isLast ? (
                        <>
                          {leadWords} <span className="text-primary">{lastWord}</span>
                        </>
                      ) : (
                        line
                      )}
                    </motion.span>
                  </span>
                );
              })}
            </h1>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.5 }}
              className="text-muted-foreground mt-7 max-w-xl text-lg leading-relaxed"
            >
              {lead}
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.58 }}
              className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            >
              <Button
                asChild
                size="lg"
                className="bg-primary-strong hover:bg-primary-strong/90 min-h-[52px] rounded-full px-8 text-base font-semibold text-white"
              >
                <Link to={primaryCta.to}>
                  {primaryCta.label}
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="ghost"
                onClick={() => scrollToSection(secondaryCta.sectionId, Boolean(reduceMotion))}
                className="text-foreground hover:bg-muted min-h-[52px] rounded-full px-5 text-base"
              >
                <span className="bg-primary/10 text-primary mr-2.5 flex h-7 w-7 items-center justify-center rounded-full">
                  <Play className="h-3.5 w-3.5 translate-x-px fill-current" aria-hidden />
                </span>
                {secondaryCta.label}
              </Button>
            </motion.div>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.7 }}
              className="text-muted-foreground/80 mt-6 text-[13px]"
            >
              {trustLine}
            </motion.p>
          </div>

          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <HeroPipelineBoard />
          </div>
        </div>
      </div>
    </section>
  );
}
