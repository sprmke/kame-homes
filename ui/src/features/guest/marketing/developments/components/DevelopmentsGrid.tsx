import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';

import { DevelopmentCard } from './DevelopmentCard';

import type { Development } from '../types';

interface DevelopmentsGridProps {
  developments: Development[];
  viewMode?: 'grid' | 'list';
}

export function DevelopmentsGrid({ developments, viewMode = 'grid' }: DevelopmentsGridProps) {
  if (developments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted mb-4 rounded-full p-5">
          <Building2 className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="text-foreground text-lg font-semibold">No developments found</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Try adjusting your filters or search criteria to find more options.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      key={viewMode}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={
        viewMode === 'grid'
          ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'mx-auto max-w-3xl space-y-4'
      }
    >
      {developments.map((development, index) => (
        <DevelopmentCard key={development.id} development={development} index={index} />
      ))}
    </motion.div>
  );
}
