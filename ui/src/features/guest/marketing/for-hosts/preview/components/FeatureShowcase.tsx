import { createRef, useMemo } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';
import { Eyebrow } from '@/features/guest/marketing/for-hosts/preview/components/Eyebrow';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { BrowserFrame } from '@/features/guest/marketing/for-hosts/preview/components/showcase/BrowserFrame';
import { showcaseDemos } from '@/features/guest/marketing/for-hosts/preview/components/showcase/showcaseDemoRegistry';
import { Chip } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import { showcaseContent } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';
import { useActiveIndex } from '@/features/guest/marketing/for-hosts/preview/hooks/useActiveIndex';

import { cn } from '@/lib/utils';

const { eyebrow, title, lead, tourLink, stories } = showcaseContent;

function DemoPanel({ id }: { id: (typeof stories)[number]['id'] }) {
  const { path, Component } = showcaseDemos[id];
  return (
    <BrowserFrame path={path}>
      <Component />
    </BrowserFrame>
  );
}

function StoryCopy({ index }: { index: number }) {
  const story = stories[index];
  return (
    <>
      <p className="text-primary text-sm font-semibold">
        <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <span className="text-muted-foreground/50">
          {' '}
          / {String(stories.length).padStart(2, '0')}
        </span>
      </p>
      <h3 className="text-foreground mt-3 text-2xl font-bold tracking-tight sm:text-[1.75rem]">
        {story.title}
      </h3>
      <p className="text-muted-foreground mt-3 max-w-md leading-relaxed">{story.body}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {story.includes.map((item) => (
          <Chip key={item.label} icon={item.icon} label={item.label} />
        ))}
      </div>
    </>
  );
}

function TourLink() {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      onClick={() => scrollToSection(tourLink.sectionId, Boolean(reduceMotion))}
      className="text-primary group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
    >
      {tourLink.label}
      <ArrowRight
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

export function FeatureShowcase() {
  const reduceMotion = useReducedMotion();
  const refs = useMemo(() => stories.map(() => createRef<HTMLDivElement>()), []);
  const activeIndex = useActiveIndex(refs);
  const activeStory = stories[activeIndex];

  return (
    <section id="platform" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">{lead}</p>
        </Reveal>

        {/* Desktop: sticky frame + scrolling stories */}
        <div className="mt-12 hidden gap-16 lg:grid lg:grid-cols-[1fr_1.05fr]">
          <div className="lg:sticky lg:top-24 lg:h-fit lg:self-start">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-primary text-sm font-semibold">{activeStory.kicker}</span>
              <span className="text-muted-foreground/70 text-xs font-medium tabular-nums">
                {activeIndex + 1} / {stories.length}
              </span>
            </div>
            <div className="mb-4 flex gap-1.5" aria-hidden>
              {stories.map((story, index) => (
                <button
                  key={story.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => scrollToSection(`showcase-story-${index}`, Boolean(reduceMotion))}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    index <= activeIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStory.id}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
              >
                <DemoPanel id={activeStory.id} />
              </motion.div>
            </AnimatePresence>
            <TourLink />
          </div>

          <div>
            {stories.map((story, index) => (
              <div
                key={story.id}
                id={`showcase-story-${index}`}
                ref={refs[index]}
                className="flex min-h-[54vh] scroll-mt-24 flex-col justify-center border-l pl-8 first:pt-4"
                style={{
                  borderColor: index <= activeIndex ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                }}
              >
                <StoryCopy index={index} />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: each story followed by its demo */}
        <div className="mt-12 space-y-12 lg:hidden">
          {stories.map((story, index) => (
            <Reveal key={story.id} className="border-primary/30 border-l pl-5">
              <StoryCopy index={index} />
              <div className="mt-6">
                <DemoPanel id={story.id} />
              </div>
            </Reveal>
          ))}
          <TourLink />
        </div>
      </div>
    </section>
  );
}
