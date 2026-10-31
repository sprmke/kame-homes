import { useLayoutEffect, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

interface FilterSectionProps {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function FilterSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: FilterSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const measure = () => setMeasuredHeight(node.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="border-border border-b pb-6 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="group flex min-h-[44px] w-full items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div>
          <h4 className="text-foreground font-medium">{title}</h4>
          {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-5 w-5 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none',
            expanded && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: expanded ? measuredHeight : 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="pt-4">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
