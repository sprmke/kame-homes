import { useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';

import { HeroCanvas } from '@/features/guest/marketing/guest-landing/components/HeroCanvas';
import { HeroSearch } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import { stayCategories } from '@/features/guest/marketing/guest-landing/data/landingContent';

import { cn } from '@/lib/utils';

export function GuestHero() {
  const navigate = useNavigate();

  const goToCategory = (query: string) => {
    navigate(`/properties?location=${encodeURIComponent(query)}`);
  };

  return (
    <section className="bg-background relative pb-12 pt-24 sm:pt-28 lg:pb-20">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-60 dark:opacity-40"
        aria-hidden
      >
        <div className="bg-primary/8 absolute -left-32 top-20 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-primary/5 absolute bottom-0 right-0 h-96 w-96 rounded-full blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
          <div className="mx-auto w-full max-w-xl lg:max-w-none">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
                Find your next stay
                <span className="text-primary block sm:inline sm:before:content-['_']">
                  in the Philippines
                </span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="mt-8"
            >
              <HeroSearch />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="mt-5"
            >
              <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                {stayCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => goToCategory(category.query)}
                    className={cn(
                      'border-border bg-muted/50 text-foreground hover:border-primary/40 hover:bg-primary/10',
                      'min-h-[44px] shrink-0 snap-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors'
                    )}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mx-auto w-full max-w-md lg:max-w-none"
          >
            <HeroCanvas />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
