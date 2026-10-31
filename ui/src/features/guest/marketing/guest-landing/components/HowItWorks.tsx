import { useRef } from 'react';

import { motion, useInView } from 'framer-motion';
import { Search, Calendar, Home, PartyPopper } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Search & Discover',
    description:
      'Browse our curated collection of properties. Filter by location, dates, amenities, and more.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Calendar,
    title: 'Book Instantly',
    description:
      'Found your perfect stay? Book it in minutes with our secure and easy checkout process.',
    color: 'from-primary to-teal-500',
  },
  {
    icon: Home,
    title: 'Check In',
    description:
      'Receive all the details you need. Self check-in or meet your host for a warm welcome.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: PartyPopper,
    title: 'Enjoy Your Stay',
    description: 'Create unforgettable memories. Our 24/7 support is here if you need anything.',
    color: 'from-rose-500 to-pink-600',
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="bg-background relative overflow-hidden py-20 lg:py-32">
      {/* Background decoration */}
      <div className="bg-mesh-wash absolute inset-0 opacity-50" />
      <div className="bg-primary/5 absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="bg-primary/10 text-primary mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium"
          >
            How It Works
          </motion.span>
          <h2 className="text-foreground mb-4 text-3xl font-bold lg:text-4xl">
            Your perfect getaway in 4 simple steps
          </h2>
          <p className="text-muted-foreground">
            Booking your dream vacation has never been easier. Follow these simple steps and start
            your adventure today.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map((step, index) => (
            <StepCard
              key={step.title}
              step={step}
              index={index}
              isInView={isInView}
              totalSteps={steps.length}
            />
          ))}
        </div>

        {/* Connection line (desktop only) */}
        <div className="absolute left-[15%] right-[15%] top-[calc(50%+100px)] hidden h-0.5 lg:block">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 1, delay: 0.5 }}
            className="from-primary/20 via-primary/40 to-primary/20 h-full origin-left bg-gradient-to-r"
          />
        </div>
      </div>
    </section>
  );
}

interface StepCardProps {
  step: (typeof steps)[0];
  index: number;
  isInView: boolean;
  totalSteps: number;
}

function StepCard({ step, index, isInView, totalSteps }: StepCardProps) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.1 * index }}
      className="group relative"
    >
      {/* Card */}
      <div className="bg-card relative rounded-2xl border p-6 text-center shadow-sm transition-all duration-300 hover:shadow-lg lg:p-8 lg:text-left">
        {/* Step number */}
        <div className="bg-background border-primary absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border-2">
          <span className="text-primary text-sm font-bold">{index + 1}</span>
        </div>

        {/* Icon */}
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className={`inline-flex rounded-2xl bg-gradient-to-br p-4 ${step.color} mb-6 shadow-lg`}
        >
          <Icon className="h-7 w-7 text-white" />
        </motion.div>

        {/* Content */}
        <h3 className="text-foreground mb-3 text-xl font-semibold">{step.title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
      </div>

      {/* Arrow to next step (mobile/tablet) */}
      {index < totalSteps - 1 && (
        <div className="text-primary absolute -bottom-6 left-1/2 hidden -translate-x-1/2 md:flex lg:hidden">
          <motion.svg
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="h-6 w-6 rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </motion.svg>
        </div>
      )}
    </motion.div>
  );
}
